/**
 * Ce que font les commandes du MM-SMPL (2026-10-04), pour la machine 3D,
 * ses jumeaux, son Dock au telephone et le clavier :
 * - smplGrab : la loupe d'une platine du MM-DECKS (sa boucle si elle en a
 *   une, sinon la fenetre de sa forme d'onde fine, centree sur la tete de
 *   lecture). Depuis le 2026-10-05, seul le mixer l'envoie (LOOP > SMPL) :
 *   les touches GRAB A et GRAB B sont retirees de la machine (Mika : "c'est
 *   moi qui envoie quelque chose a la machine") ;
 * - FILE : un fichier audio ; REC : la sortie du site (le MM-RYTM, le
 *   MM-ARP, les platines), jusqu'au second appui ;
 * - SLICES : 4, 8, 16 parts egales de la region, ou AUTO (les attaques) ;
 *   MODE : SLICE ou GRAIN ; REV ; LOOP ; SAVE : la region en WAV, au PITCH
 *   (a l'envers avec REV) ;
 * - les pads : SLICE, la slice du pad ; GRAIN, un nuage de grains au debut
 *   de sa slice, tant qu'on le tient ; PLAY : la sequence s'il y en a une
 *   (smpl/seq.ts), sinon la region entiere, ou le nuage a POSITION ;
 * - RANDOM, CLEAR, EDIT (2026-10-05) : la sequence (une au hasard, qui part ;
 *   vide ; EDIT fait des trigs ses seize pas) ;
 * - les potards : smplParams ; START, END et SLICES refont la decoupe.
 */

import { gesture } from '../actions';
import { djLoad } from '../state/djload';
import type { DjDeck } from '../dj/theme';
import { SMPL_MAX_S, smplEngine } from './engine';
import { pitchSemis, smplParams, smplReadout, type SmplKnobId } from './params';
import { randomSteps, smplSeq } from './seq';
import { SMPL_PADS, SMPL_SLICINGS, equalSlices, onsetSlices, wavOf } from './slices';
import { padCount, padSlice, regionOf, smplState } from './state';

/** L'identifiant de PLAY pour le moteur (les pads : 0 a 15) ; celui de l'ecoute d'une slice en EDIT. */
const PREVIEW = 100;
const AUDITION = 150;
const NO_SAMPLE = 'PICK A FILE, REC, OR SEND A LOOP FROM THE MIXER';

/* ---------------- la decoupe ---------------- */

/** Refait les slices pour la region et SLICES du moment. */
export function reslice(): void {
  const s = smplState.get();
  const d = smplEngine.data();
  if (!s.sample || !d) {
    if (s.slices.length) smplState.set({ slices: [] });
    return;
  }
  const v = smplParams.get();
  const { a, b } = regionOf(v.start, v.end);
  const slices = s.slicing === 'auto' ? onsetSlices(d.mono, d.rate, a, b, SMPL_PADS) : equalSlices(a, b, s.slicing);
  smplState.set({ slices });
}

// START et END bougent : la decoupe suit (au plus une fois par image)
let resliceRaf = 0;
let lastRegion = '';
smplParams.subscribe(() => {
  const v = smplParams.get();
  const k = `${v.start}|${v.end}`;
  if (k === lastRegion) return;
  lastRegion = k;
  if (resliceRaf) return;
  resliceRaf = requestAnimationFrame(() => {
    resliceRaf = 0;
    reslice();
  });
});

/* ---------------- les sources ---------------- */

function placed(channels: Float32Array[], rate: number, name: string, source: 'deck' | 'file' | 'rec'): void {
  const dur = smplEngine.setSample(channels, rate, name, source);
  // Un sample neuf : la region entiere
  smplParams.set('start', 0);
  smplParams.set('end', 1);
  reslice();
  smplState.say(`${name.toUpperCase()}  ${dur.toFixed(2)} S`);
}

/** GRAB : la loupe d'une platine (sa boucle, sinon la fenetre a l'ecran). */
export function smplGrab(deck: DjDeck): void {
  gesture();
  const m = djLoad.get();
  const e = m?.djEngineIfAny();
  const st = m?.djState.get();
  const p = e?.decks[deck];
  if (!m || !e || !st || !p || !p.loaded) {
    smplState.say(`DECK ${deck.toUpperCase()} IS EMPTY: LOAD A TRACK FIRST`);
    return;
  }
  const ds = st.deck[deck];
  const loop = p.loop;
  const pos = p.position();
  const half = Math.min(SMPL_MAX_S, ds.zoom) / 2;
  const a = loop ? loop.a : Math.max(0, pos - half);
  const b = loop ? loop.b : Math.min(p.duration, pos + half);
  const x = p.excerpt(a, b);
  if (!x) {
    smplState.say('NOTHING TO GRAB HERE');
    return;
  }
  const title = ds.track?.title ?? `DECK ${deck.toUpperCase()}`;
  placed(x.channels, x.rate, `${title} ${a.toFixed(1)}S`, 'deck');
}

/** FILE : un fichier audio (le choix du systeme, ou un fichier depose). */
export async function smplLoadFile(file: File): Promise<void> {
  gesture();
  const port = (await smplEngine.ensure())?.ctx ?? null;
  smplState.set({ busy: true });
  smplState.say(`LOADING ${file.name.toUpperCase()}`, 60000);
  try {
    const bytes = await file.arrayBuffer();
    const ctx = port ?? new OfflineAudioContext(2, 1, 48000);
    const buf = await ctx.decodeAudioData(bytes);
    const ch = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c));
    placed(ch, buf.sampleRate, file.name.replace(/\.[a-z0-9]+$/i, ''), 'file');
    if (buf.duration > SMPL_MAX_S) smplState.say(`KEPT THE FIRST ${SMPL_MAX_S} S`);
  } catch {
    smplState.say('THIS FILE DOES NOT DECODE');
  } finally {
    smplState.set({ busy: false });
  }
}

/** FILE : ouvre le choix d'un fichier. */
export function smplPickFile(): void {
  gesture();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac,.ogg';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void smplLoadFile(f);
  };
  input.click();
}

/** REC : enregistre la sortie du site ; second appui : la prise devient le sample. */
export function smplRec(): void {
  gesture();
  if (smplState.get().recording) {
    smplEngine.stopRecord();
    return;
  }
  smplState.set({ recording: true });
  smplState.say('RECORDING THE SITE OUTPUT: PRESS REC TO STOP', 60000);
  void smplEngine.record().then((take) => {
    smplState.set({ recording: false });
    if (!take || take.channels[0].length < take.rate * 0.05) {
      smplState.say('NOTHING RECORDED');
      return;
    }
    placed(take.channels, take.rate, 'REC', 'rec');
  });
}

/* ---------------- les reglages ---------------- */

export function smplSlicingNext(): void {
  const s = smplState.get();
  const next = SMPL_SLICINGS[(SMPL_SLICINGS.indexOf(s.slicing) + 1) % SMPL_SLICINGS.length];
  smplState.set({ slicing: next });
  reslice();
  smplState.say(next === 'auto' ? `SLICES AUTO: ${Math.max(0, smplState.get().slices.length - 1)} HITS` : `SLICES ${next}`);
}

export function smplModeToggle(): void {
  const s = smplState.get();
  // Les voix se taisent ; la sequence continue (elle jouera dans le nouveau mode)
  smplEngine.stop();
  smplState.set({ pads: [], preview: false });
  smplState.set({ mode: s.mode === 'slice' ? 'grain' : 'slice' });
  smplState.say(smplState.get().mode === 'grain' ? 'GRAIN: PADS PLAY A GRAIN CLOUD' : 'SLICE: PADS PLAY THEIR SLICE');
}

export function smplReverse(): void {
  smplState.set({ reverse: !smplState.get().reverse });
}

export function smplLoopToggle(): void {
  smplState.set({ loop: !smplState.get().loop });
}

/** Un potard (0 a 1) ; l'ecran dit sa valeur. POSITION deplace le nuage de PLAY. */
export function smplDial(id: SmplKnobId, v: number): void {
  if (!smplParams.set(id, v)) return;
  const s = smplState.get();
  smplState.say(smplReadout(id, smplParams.of(id), s.sample?.duration ?? 0), 1400);
  if (id === 'position' && s.preview && s.mode === 'grain') smplEngine.move(PREVIEW, cloudPos());
}

/* ---------------- jouer ---------------- */

/** La position du nuage de PLAY : POSITION dans la region. */
function cloudPos(): number {
  const v = smplParams.get();
  const { a, b } = regionOf(v.start, v.end);
  return a + (b - a) * v.position;
}

/** L'instant de chaque appui : le moteur ne le donne qu'un peu plus tard (sa lumiere tient en attendant). */
const pressedAt = new Map<number, number>();
const FRESH_MS = 250;

function setPad(i: number, on: boolean): void {
  if (on) pressedAt.set(i, performance.now());
  const pads = smplState.get().pads.filter((p) => p !== i);
  smplState.set({ pads: on ? [...pads, i] : pads });
}

/** Un pad enfonce ou lache (pointeur, jumeau, clavier, Dock). */
export function smplPad(i: number, down: boolean): void {
  const s = smplState.get();
  if (down) {
    gesture();
    const sl = padSlice(i);
    if (!sl) {
      if (!s.sample) smplState.say(NO_SAMPLE);
      return;
    }
    const v = smplParams.get();
    const { a, b } = regionOf(v.start, v.end);
    if (s.mode === 'grain') smplEngine.cloud(i, sl.a, a, b);
    else smplEngine.play(i, sl.a, sl.b, s.loop);
    setPad(i, true);
    return;
  }
  // Lache : un nuage et une slice bouclee s'eteignent ; une slice simple va au bout (sa lumiere s'eteint seule)
  smplEngine.release(i);
  if (s.mode === 'grain' || s.loop) setPad(i, false);
}

/**
 * PLAY : la sequence s'il y a des pas (un appui la lance, un autre
 * l'arrete) ; sinon la region entiere (SLICE) ou le nuage a POSITION (GRAIN).
 */
export function smplPlayToggle(): void {
  gesture();
  const s = smplState.get();
  if (smplSeq.get().running) {
    smplSeq.stop();
    return;
  }
  if (!s.sample) {
    smplState.say(NO_SAMPLE);
    return;
  }
  if (smplSeq.any() && !s.preview) {
    void smplEngine.ensure();
    if (smplSeq.start()) smplState.say('SEQUENCE PLAYING', 1400);
    return;
  }
  if (s.preview) {
    smplEngine.release(PREVIEW);
    smplState.set({ preview: false });
    return;
  }
  const v = smplParams.get();
  const { a, b } = regionOf(v.start, v.end);
  if (s.mode === 'grain') smplEngine.cloud(PREVIEW, cloudPos(), a, b);
  else smplEngine.play(PREVIEW, a, b, s.loop);
  pressedAt.set(PREVIEW, performance.now());
  smplState.set({ preview: true });
}

/** STOP, Echap : tout se tait, la sequence s'arrete. */
export function smplStopAll(): void {
  smplSeq.stop();
  smplEngine.stop();
  smplState.set({ pads: [], preview: false });
}

/* ---------------- la sequence ---------------- */

/** RANDOM : une sequence au hasard sur les slices du moment ; elle part (s'il y a un sample). */
export function smplRandom(): void {
  gesture();
  const n = padCount();
  smplSeq.setAll(randomSteps(n || 8));
  if (!smplState.get().sample) {
    smplState.say(`RANDOM SEQUENCE: ${NO_SAMPLE}`);
    return;
  }
  if (smplState.get().preview) {
    smplEngine.release(PREVIEW);
    smplState.set({ preview: false });
  }
  void smplEngine.ensure();
  smplSeq.start();
  smplState.say('RANDOM SEQUENCE', 1400);
}

/** CLEAR : la sequence se vide (elle tourne encore si elle tournait : on peut la redessiner en EDIT). */
export function smplClear(): void {
  if (!smplSeq.any()) {
    smplState.say('THE SEQUENCE IS EMPTY', 1400);
    return;
  }
  smplSeq.clear();
  smplState.say('SEQUENCE CLEARED', 1400);
}

/** EDIT : les trigs deviennent les seize pas de la sequence, ou redeviennent les slices. */
export function smplEditToggle(): void {
  const on = !smplSeq.get().edit;
  smplSeq.setEdit(on);
  smplState.say(on ? 'EDIT: TAP A TRIG FOR A STEP, DRAG IT UP OR DOWN FOR ITS SLICE' : 'EDIT CLOSED', on ? 3200 : 1400);
}

/** EDIT : on ecoute la slice d'un pas qu'on regle (seulement a l'arret : la sequence joue deja). */
function audition(k: number | null): void {
  if (k === null || smplSeq.get().running) return;
  const sl = padSlice(k);
  if (sl) smplEngine.play(AUDITION, sl.a, sl.b, false);
}

/** EDIT : taper un pas (plein : il se vide ; vide : la slice de son rang). */
export function smplStepTap(i: number): void {
  gesture();
  // Un pas vide prend la slice de son rang dans la decoupe du moment (8 slices : le pas 9 joue la 1)
  const n = padCount();
  smplSeq.toggle(i, n > 0 ? i % n : i);
  const v = smplSeq.get().steps[i];
  smplState.say(v === null ? `STEP ${i + 1} OFF` : `STEP ${i + 1}  SLICE ${(smplSeq.sliceOf(v) ?? v) + 1}`, 1400);
}

/**
 * Un trig du clavier, du MIDI, d'un jumeau ou du Dock : en EDIT, l'appui
 * pose ou enleve son pas (le lacher ne fait rien) ; sinon, son pad.
 */
export function smplTrig(i: number, down: boolean): void {
  if (smplSeq.get().edit) {
    if (down) smplStepTap(i);
    return;
  }
  smplPad(i, down);
}

/** EDIT : la slice d'un pas (glisser sur son trig, les fleches de son jumeau) ; on l'entend a l'arret. */
export function smplStepSlice(i: number, v: number): void {
  gesture();
  const max = Math.max(1, padCount() || SMPL_PADS);
  const k = Math.max(0, Math.min(max - 1, Math.round(v)));
  if (smplSeq.get().steps[i] === k) return;
  smplSeq.set(i, k);
  smplState.say(`STEP ${i + 1}  SLICE ${k + 1}`, 1400);
  audition(k);
}

// Une voix simple finie : sa lumiere s'eteint (les positions ne la donnent plus)
smplEngine.subscribeLive(() => {
  const s = smplState.get();
  const live = smplEngine.live();
  const now = performance.now();
  const sounds = (id: number): boolean => live.voices.has(id) || live.clouds.has(id) || now - (pressedAt.get(id) ?? -Infinity) < FRESH_MS;
  const pads = s.pads.filter(sounds);
  const preview = s.preview && sounds(PREVIEW);
  if (pads.length !== s.pads.length || preview !== s.preview) smplState.set({ pads, preview });
});

/* ---------------- SAVE ---------------- */

/** La region au PITCH (vitesse changee, comme a l'ecoute en SLICE), a l'envers avec REV. */
function render(): { channels: Float32Array[]; rate: number } | null {
  const d = smplEngine.data();
  const s = smplState.get();
  if (!d || !s.sample) return null;
  const v = smplParams.get();
  const { a, b } = regionOf(v.start, v.end);
  const i0 = Math.floor(a * d.rate);
  const i1 = Math.min(d.channels[0].length, Math.ceil(b * d.rate));
  const step = Math.pow(2, pitchSemis(v.pitch) / 12);
  const n = Math.max(2, Math.floor((i1 - i0) / step));
  const out = d.channels.map((c) => {
    const o = new Float32Array(n);
    for (let k = 0; k < n; k += 1) {
      const x = i0 + k * step;
      const j = Math.floor(x);
      const t = x - j;
      const y1 = c[Math.min(c.length - 1, j)];
      const y2 = c[Math.min(c.length - 1, j + 1)];
      o[k] = y1 + (y2 - y1) * t;
    }
    if (s.reverse) o.reverse();
    return o;
  });
  return { channels: out, rate: d.rate };
}

/** SAVE : la region en WAV, telechargee. */
export function smplSave(): void {
  const r = render();
  const s = smplState.get();
  if (!r || !s.sample) {
    smplState.say('NOTHING TO SAVE YET');
    return;
  }
  const wav = wavOf(r.channels, r.rate);
  const semis = pitchSemis(smplParams.of('pitch'));
  const safe = s.sample.name.replace(/[^a-z0-9 ._-]+/gi, '').trim().slice(0, 40) || 'sample';
  const name = `MM-SMPL ${safe}${semis ? ` ${semis > 0 ? '+' : ''}${semis}` : ''}${s.reverse ? ' REV' : ''}.wav`;
  const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  smplState.say(`SAVED ${name.toUpperCase()}`);
}

/** Au chargement du code : le sample d'une visite passee revient, sa decoupe aussi. */
void smplEngine.restore().then((ok) => {
  if (ok) reslice();
});
