/**
 * Ce que font les commandes du MM-BASS (2026-10-07), pour la machine 3D, ses
 * jumeaux, le clavier et le MIDI :
 * - RUN : la sequence part sur la grille du MM-RYTM (ou du MM-ARP), ou s'arrete ;
 * - GEN : une nouvelle ligne du generateur (STYLE, DENSITY, SLIDES, ACCENTS,
 *   RANGE ; la gamme) ; elle part si rien ne jouait ;
 * - MUTATE : quelques pas changent ; CLEAR : plus rien ;
 * - un pas (TRIG) : il est choisi ; taper le fait passer de vide a note, de
 *   note a liaison (TIE, s'il suit une note), de liaison a vide ; a l'arret,
 *   on entend sa note ;
 * - ACCENT, SLIDE, NOTE - +, OCT - + : sur le pas choisi ;
 * - les potards : bassParams, l'ecran dit leur valeur ;
 * - LOCK (2026-10-07, les boutons au-dessus des pas, les parameter locks des
 *   Elektron) : le pas dont on regle les verrous ; les potards du son ne
 *   changent alors que lui (deux tapes sur un potard : son verrou s'en va ;
 *   CLEAR : tous ceux du pas) ; le meme bouton, Echap ou EDIT en sortent ;
 * - EDIT (2026-10-07) : les seize pas deviennent les seize patterns (taper,
 *   chainer, tenir un vide pour copier, bass/patterns.ts).
 * Une piste SoundCloud du site qui part : la basse se tait (comme RUN).
 *
 * LOCK qu'on entend et qu'on voit (2026-10-08, Mika : "mes parameter locks ne
 * fonctionnent pas : je clique sur le bouton au-dessus des pas et ca ne fait
 * rien") : ils marchaient, mais a l'arret rien ne sonnait et rien ne
 * changeait sur la machine. Desormais :
 * - entrer en LOCK, puis chaque reglage (une fois le potard pose), fait
 *   entendre le pas a l'arret ;
 * - un pas vide qu'on verrouille recoit une note (la tonique) : un verrou
 *   sur un pas vide ne se serait jamais entendu ;
 * - tenir un pas (350 ms, sans glisser) le verrouille, comme une Elektron :
 *   un potard tourne pendant l'appui, et le lacher sort (au doigt, deux
 *   doigts) ; sans potard tourne, le LOCK reste ;
 * - ACCENT verrouille sur un pas sans accent lui donne l'accent.
 *
 * La machine Elektron (2026-10-08, Mika : "quand on clique sur un step on
 * selectionne la partie qu'on veut modifier, est-ce que le voice, est-ce que
 * le FX, est-ce que l'enveloppe, et ensuite on tourne un encodeur sur ce
 * step") : les pages (bass/pages.ts) ; en LOCK, un reglage verrouille sur le
 * pas (un cran entier pour un reglage a crans), deux tapes l'en retirent ; un
 * reglage GLOBAL (OCTAVE, les reglages des effets) ne bouge pas en LOCK et
 * l'ecran le dit, jamais un geste qui ne fait rien en silence.
 *
 * L'etape 2 (2026-10-09, Mika : "on dirait que les parameters lock ne
 * fonctionnent pas ; quand on selectionne un step on rentre en parameters
 * lock ; en desktop les encoders ne servent qu'a faire les modifs des FX
 * globaux de la machine, les FX des parameters lock se font dans l'ecran ;
 * je ne vois pas ce que STYLE et DENSITY font") :
 * - choisir un pas, c'est le P-LOCK : une tape sur un pas vide y pose une
 *   note et le choisit en P-LOCK (ajouter des notes reste une tape par
 *   note) ; une tape sur une note ou une liaison qui n'est pas en P-LOCK la
 *   choisit en P-LOCK sans la changer ; une tape sur le pas en P-LOCK le fait
 *   passer de note a liaison a vide (vide : le P-LOCK s'en va). On en sort
 *   aussi par sa touche LOCK, Echap, ou la pastille P-LOCK 05 de l'en-tete de
 *   l'ecran. En P-LOCK, les blocs de l'ecran reglent les verrous du pas ;
 *   hors P-LOCK, le son de toute la ligne (au telephone, sans encodeurs,
 *   c'est la seule facon de le regler). Un glisser sur un pas (sa note) le
 *   choisit aussi ;
 * - les encodeurs de la face (desktop) : les FX globaux pour de bon
 *   (bassFxDial), jamais un verrou, meme en P-LOCK ; l'ecran montre le
 *   reglage dans une bulle sans changer de page ;
 * - EDIT ouvert : une touche LOCK ferme EDIT et met le P-LOCK sur son pas,
 *   d'un geste (EDIT CLOSED, P-LOCK 05) ; dans EDIT, le rouleau de l'ecran
 *   change la hauteur des notes a la souris (bassEditNote) ;
 * - STYLE, DENSITY et les regles du generateur reecrivent les pas du
 *   generateur de la ligne a chaque cran, depuis sa recette (sa graine,
 *   bass/state.ts) : les pas faits a la main restent, tous les P-locks aussi ;
 *   DENSITY ne fait qu'ajouter des notes en montant, qu'en retirer en
 *   descendant ; sur une ligne faite a la main, des notes generees s'ajoutent
 *   autour des tiennes, l'ecran le dit (YOUR NOTES KEPT), jamais PRESS GEN ;
 * - GEN garde les P-locks des pas qui restent des notes, ou dit P-LOCKS
 *   CLEARED.
 * La revue de l'etape 2 (le meme jour) :
 * - le P-LOCK d'une tape (bassTapLocked) ne change ni le Roto (sa tape pose
 *   ou retire une note) ni les potards MIDI d'un reglage (le son de toute la
 *   ligne) ; un LOCK pose par un geste de LOCK, si ;
 * - STYLE et DENSITY ne reecrivent jamais le pas en P-LOCK ; sur un preset
 *   d'usine ils agissent (sa ligne a sa DENSITY, eclaircie au-dessous, un
 *   autre STYLE la reecrit, son STYLE la rend) et l'ecran ne dit plus YOUR
 *   NOTES pour ses notes ; l'echo de DENSITY dit ou la ligne gagne et perd sa
 *   prochaine note (MORE AT 82 · FEWER AT 70) ;
 * - un reglage GLOBAL refuse dit le nom de son potard (TURN THE DLY TIME
 *   KNOB), plus une lettre qui se confondait avec les blocs.
 */

import { gesture } from '../actions';
import { pattern } from '../audio/pattern';
import { sc } from '../audio/soundcloud';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { presetMode } from '../state/presetMode';
import { PORTRAIT } from '../theme';
import { bassEngine } from './engine';
import { generate, isFreeStep, mutate, regenerate, type GenOpts, type RegenOpts } from './gen';
import type { BassRecipe, BassStep } from './state';
import { BASS_SCALES, BASS_STYLES, SCALE_TONES, bassKnob, bassParams, bassValueText, stepOf, type BassKnobId } from './params';
import { BASS_FX_KNOBS, BASS_PAGES, BASS_SCREEN_SLOTS, PAGE_TABS, SCREEN_LABEL, bassFxEncOf, bassPage, bassPageDef, isBassGlobal, screenTitle, type BassPageId, type BassScreenId } from './pages';
import { bassPatterns, bassSlotName } from './patterns';
import { GATE, bassSeq, gateOf, midiOf } from './seq';
import { BASS_STEPS, bassState, emptyStep, isLockable } from './state';

const two = (i: number): string => String(i + 1).padStart(2, '0');
/** Le geste qui regle un verrou : glisser un bloc de l'ecran, au telephone comme au desktop (2026-10-09, l'etape 2). */
const TURN = 'DRAG A VALUE';

/** EDIT est ouvert sur le MM-BASS : les pas sont les patterns. */
export const bassEditing = (): boolean => editor.get() === 'bass';

const genOpts = (): GenOpts => {
  const v = bassParams.get();
  return {
    style: BASS_STYLES[stepOf('style', v.style)],
    density: v.density,
    slides: v.slides,
    accents: v.accents,
    range: stepOf('range', v.range) + 1,
    degrees: SCALE_TONES[BASS_SCALES[stepOf('scale', v.scale)]].length,
  };
};

/** Les regles du generateur du moment, telles que la recette les garde (0 a 1). */
const genSnap = (): NonNullable<BassRecipe['gen']> => {
  const v = bassParams.get();
  return { style: v.style, density: v.density, slides: v.slides, accents: v.accents, range: v.range };
};

const newSeed = (): number => Math.floor(Math.random() * 4294967296) >>> 0;

export function bassRun(): void {
  gesture();
  if (bassSeq.running) {
    bassSeq.stop();
    return;
  }
  void bassEngine.ensure().then(() => bassSeq.start());
}

/** Les potards du generateur : chaque cran reecrit les pas du generateur de la ligne (2026-10-09). */
const GEN_LIVE: readonly BassKnobId[] = ['style', 'density', 'slides', 'accents', 'range'];
/** La ligne suit-elle STYLE et DENSITY ? Toujours depuis le 2026-10-09 (la recette ; une ligne sans graine en recoit une). */
export const bassGenLive = (): boolean => true;

/** Les notes de la ligne qui sont a toi (ni du generateur ni libres) : STYLE et DENSITY n'y touchent pas. */
const handNotes = (steps: readonly BassStep[]): number => steps.filter((s) => s.kind === 'note' && !isFreeStep(s)).length;
const noteCount = (steps: readonly BassStep[]): number => steps.filter((s) => s.kind === 'note').length;

/** GEN : une ligne neuve (une graine neuve) ; les P-locks des pas qui restent des notes sont gardes. Rend ce qu'il dit. */
function writeGen(): { style: string; kept: number; cleared: number } {
  const o = genOpts();
  const seed = newSeed();
  const fresh = generate({ ...o, seed });
  const old = bassState.get().steps;
  let kept = 0;
  let cleared = 0;
  const steps = fresh.map((s, i): BassStep => {
    const l = old[i]?.locks;
    if (!l) return s;
    if (s.kind === 'note') {
      kept += 1;
      return { ...s, locks: l };
    }
    cleared += 1;
    return s;
  });
  bassState.set({ steps, gen: bassState.get().gen + 1, recipe: { seed, base: null, gen: genSnap() } });
  return { style: o.style, kept, cleared };
}

/** GEN : une ligne neuve ; elle part si la basse ne jouait pas. */
export function bassGenerate(): void {
  gesture();
  const r = writeGen();
  bassState.set({ sel: 0, lock: -1 });
  const tail = r.cleared ? `  P-LOCKS CLEARED${r.kept ? `, ${r.kept} KEPT` : ''}` : r.kept ? `  ${r.kept} P-LOCK STEP${r.kept > 1 ? 'S' : ''} KEPT` : '';
  bassState.say(`${r.style} LINE${tail}`, tail ? 2400 : 1600);
  if (!bassSeq.running) void bassEngine.ensure().then(() => bassSeq.start());
}

export function bassMutate(): void {
  gesture();
  bassState.set({ steps: mutate(bassState.get().steps, genOpts()), gen: bassState.get().gen + 1 });
  bassState.say('MUTATED', 1200);
}

export function bassClear(): void {
  // En P-LOCK : les verrous du pas seulement
  const st = bassState.get();
  if (st.lock >= 0) {
    // L'accent pose par un verrou d'ACCENT s'en va avec les verrous
    bassState.setStep(st.lock, { ...(accByLock.delete(st.lock) ? { acc: false } : {}), locks: undefined });
    bassState.say(`P-LOCK ${two(st.lock)} CLEARED`, 1400);
    return;
  }
  // Une ligne vide (2026-10-09) : tous ses pas sont libres, DENSITY en remontant y remet des notes une a une (la recette
  // garde sa graine, ancree a la DENSITY du moment : a ce cran, la ligne est vide)
  const seed = st.recipe?.seed ?? newSeed();
  bassState.set({ steps: Array.from({ length: BASS_STEPS }, emptyStep), recipe: { seed, base: bassParams.of('density'), gen: genSnap() } });
  bassState.say('CLEARED  DENSITY UP: NEW NOTES', 1600);
}

/** A l'arret : on entend la note d'un pas qu'on regle. */
function audition(i: number): void {
  if (bassSeq.running) return;
  const s = bassState.get().steps[i];
  if (s.kind !== 'note') return;
  gesture();
  // La duree de la note comme en lecture (LENGTH, son verrou, ou le style en AUTO) : un verrou de LENGTH s'entend
  const gate = Math.max(0.05, gateOf(s, 60 / pattern.get().bpm / 4));
  void bassEngine.ensure().then(() => {
    bassEngine.on(midiOf(s), s.acc, false, 0, s.locks ?? null);
    const c = bassEngine.ctx;
    bassEngine.off(c ? c.currentTime + gate : 0);
  });
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const noteName = (midi: number): string => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

const stepText = (s: BassStep): string => (s.kind === 'off' ? 'OFF' : s.kind === 'tie' ? 'TIE' : `${noteName(midiOf(s))}${s.acc ? '  ACC' : ''}${s.slide ? '  SLIDE' : ''}`);

function sayStep(i: number, tail = ''): void {
  const s = bassState.get().steps[i];
  const st = bassState.get();
  bassState.say(`${st.lock === i ? 'P-LOCK' : 'STEP'} ${two(i)}  ${stepText(s)}${tail}`, tail ? 2400 : 1600);
}

/** Un pas change a la main (2026-10-09) : il est a toi, STYLE et DENSITY n'y touchent plus. */
const hand = (patch: Partial<BassStep>): Partial<BassStep> => ({ ...patch, src: 'hand' });

/**
 * Taper un pas (2026-10-09, l'etape 2, Mika : "quand on selectionne un step on rentre en parameters lock") :
 * - un pas vide recoit une note (la tonique) et passe en P-LOCK ;
 * - une note ou une liaison qui n'est pas en P-LOCK y passe, sans changer ;
 * - le pas deja en P-LOCK : note, liaison (apres une note), vide ; vide, le P-LOCK s'en va.
 * En EDIT : son pattern.
 */
export function bassStepTap(i: number): void {
  gesture();
  if (bassEditing()) {
    bassPatternTap(i);
    return;
  }
  const st = bassState.get();
  if (i < 0 || i >= BASS_STEPS) return;
  const s = st.steps[i];
  if (s.kind === 'off') {
    // Un pas vide : une note, et le P-LOCK dessus (ajouter des notes : une tape par note, comme avant)
    bassState.setStep(i, hand({ kind: 'note', deg: 0, oct: 0, acc: false, slide: false }));
    latch(i, 'NEW NOTE');
    audition(i);
    return;
  }
  if (st.lock !== i) {
    latch(i, '');
    audition(i);
    return;
  }
  // Le pas en P-LOCK : il change (note, liaison, vide), comme une tape d'avant
  const prev = st.steps[(i + BASS_STEPS - 1) % BASS_STEPS];
  const kind = s.kind === 'note' && prev.kind !== 'off' ? 'tie' : 'off';
  bassState.setStep(i, hand({ kind }));
  if (kind === 'off') {
    lockGen += 1;
    bassState.set({ lock: -1, sel: i });
    bassState.say(`STEP ${two(i)}  OFF  P-LOCK OFF`, 1600);
    return;
  }
  sayStep(i);
  audition(i);
}

/**
 * Le P-LOCK fixe sur un pas (une tape, un glisser de sa note) : le pas choisi, ses verrous a l'ecran ; what : ce qu'on
 * vient d'y faire (NEW NOTE), sinon le compte de ses verrous et le geste.
 */
function latch(i: number, what: string): void {
  const st = bassState.get();
  if (st.lock !== i) {
    lockTurns = 0;
    lockGen += 1;
    tapLock = i;
  }
  bassState.set({ lock: i, sel: i });
  const s = bassState.get().steps[i];
  const n = Object.keys(s.locks ?? {}).length;
  bassState.say(`P-LOCK ${two(i)}  ${what ? `${what} ${stepText(s)}` : stepText(s)}  ${n ? `${n} P-LOCK${n > 1 ? 'S' : ''}` : TURN}`, 2000);
}

/**
 * Un pas tape sur le Roto-Control (2026-10-09, midi/seqlink.ts, Mika : "j'ajoute
 * mes steps") : un geste, un etat, comme un trig d'Elektron : vide, une note (la
 * tonique, comme une tape sur un pas vide) ; une note ou une liaison, vide. Il
 * est choisi (NOTE, OCT, ACCENT, SLIDE de la page 3 du setup BSEQ le reglent
 * ensuite, l'ecran le dit) et on l'entend a l'arret. Changer la note d'un pas
 * deja pose : le tenir (LOCK), NOTE ou OCT, une tape sur le pas en sort. En
 * EDIT : comme une tape sur la face ; en LOCK (le setup BSEQ, la revue de la
 * meme date) : une tape sur le pas en LOCK en sort, une tape sur un autre y
 * deplace le LOCK, sa note ne change pas (l'etape 2 de la face change ce que
 * fait une tape sur la face, pas sur le Roto). La seconde revue du meme jour :
 * ce LOCK-la est celui d'un geste de LOCK (tenir un pas, sa touche LOCK, le
 * Roto tenu) ; le P-LOCK qu'une simple tape sur l'ecran ou le clavier a pose
 * (bassTapLocked) ne change rien au Roto : sa tape pose ou retire la note, le
 * P-LOCK de l'ecran s'en va.
 */
export function bassStepToggle(i: number): void {
  if (bassEditing()) {
    bassStepTap(i);
    return;
  }
  // Un P-LOCK pose par une tape sur l'ecran ou le clavier (la revue du 2026-10-09) : le Roto pose et retire ses notes
  // comme avant, le P-LOCK de l'ecran s'en va (le pas choisi passe au pas du Roto) ; un LOCK pose par un geste de LOCK
  // (tenir un pas, sa touche LOCK, le Roto tenu) : une tape le deplace ou en sort, comme le setup BSEQ le veut
  if (bassTapLocked()) {
    lockGen += 1;
    bassState.set({ lock: -1 });
  } else if (bassState.get().lock >= 0) {
    if (bassState.get().lock === i) bassLockOff();
    else bassLockEnter(i);
    return;
  }
  gesture();
  const s = bassState.get().steps[i];
  if (!s) return;
  const on = s.kind === 'off';
  bassState.setStep(i, hand(on ? { kind: 'note', deg: 0, oct: 0 } : { kind: 'off' }), { sel: i });
  // L'ecran dit la suite sur le Roto (la revue du 2026-10-09) : la note se regle a la page 3, la tenue met le LOCK
  sayStep(i, on ? '  P3: NOTE OCT  HOLD: LOCK' : '  HOLD: LOCK');
  if (on) audition(i);
}

/** Glisser sur un pas : sa note dans la gamme (un pas vide devient une note) ; le pas passe en P-LOCK (2026-10-09). */
export function bassStepDeg(i: number, deg: number): void {
  const st = bassState.get();
  const s = st.steps[i];
  if (!s) return;
  const d = Math.max(0, Math.min(20, deg));
  if (s.kind === 'note' && s.deg === d && st.lock === i) return;
  bassState.setStep(i, hand({ kind: 'note', deg: d }));
  if (st.lock !== i && !bassEditing()) {
    lockTurns = 0;
    lockGen += 1;
    tapLock = i;
  }
  bassState.set(bassEditing() ? { sel: i } : { sel: i, lock: i });
  sayStep(i);
  audition(i);
}

export function bassAccent(): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, hand({ acc: !s.acc }));
  sayStep(st.sel);
}

export function bassSlide(): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, hand({ slide: !s.slide }));
  sayStep(st.sel);
}

/** NOTE - + : un degre de la gamme ; OCT - + : une octave. */
export function bassNote(dir: -1 | 1): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind !== 'note') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, hand({ deg: Math.max(0, Math.min(20, s.deg + dir)) }));
  sayStep(st.sel);
  audition(st.sel);
}

export function bassOct(dir: -1 | 1): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind !== 'note') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, hand({ oct: Math.max(-1, Math.min(2, s.oct + dir)) }));
  sayStep(st.sel);
  audition(st.sel);
}

/* ---------------- EDIT : la hauteur des notes au rouleau (2026-10-09) ---------------- */

/**
 * Le rouleau d'EDIT (2026-10-09, Mika : "dans EDIT pouvoir editer la hauteur des notes a la souris sur l'ecran") : le
 * pas i joue cette note (un degre de la gamme et une octave ; un vide ou une liaison deviennent une note), ecrite dans
 * le pattern courant (bass/patterns.ts la garde), entendue a la boucle suivante ; a l'arret, on l'entend.
 */
export function bassEditNote(i: number, deg: number, oct: number): void {
  const s = bassState.get().steps[i];
  if (!s) return;
  const d = Math.max(0, Math.min(20, Math.round(deg)));
  const o = Math.max(-1, Math.min(2, Math.round(oct)));
  if (s.kind === 'note' && s.deg === d && s.oct === o) return;
  bassState.setStep(i, hand({ kind: 'note', deg: d, oct: o }), { sel: i });
  const now = bassState.get().steps[i];
  bassState.say(`STEP ${two(i)}  ${noteName(midiOf(now))}`, 1400);
  audition(i);
}

/** Une tape sur une note du rouleau : note, liaison (apres une note), vide ; une liaison : vide. */
export function bassEditCycle(i: number): void {
  const st = bassState.get();
  const s = st.steps[i];
  if (!s || s.kind === 'off') return;
  const prev = st.steps[(i + BASS_STEPS - 1) % BASS_STEPS];
  const kind = s.kind === 'note' && prev.kind !== 'off' ? 'tie' : 'off';
  bassState.setStep(i, hand({ kind }), { sel: i });
  bassState.say(`STEP ${two(i)}  ${kind === 'tie' ? 'TIE' : 'OFF'}`, 1400);
}

/**
 * Le degre d'a cote dans la gamme (la molette du rouleau d'EDIT, la revue du 2026-10-09 : la recherche de la hauteur la
 * plus proche restait coincee aux ecarts de trois demi-tons et sous la tonique) : deg +- 1, l'octave qui suit sous la
 * tonique ou au-dela du degre 20 ; null au bout (OCT -1 a +2).
 */
export function bassDegStep(deg: number, oct: number, dir: -1 | 1): { deg: number; oct: number } | null {
  const L = SCALE_TONES[BASS_SCALES[stepOf('scale', bassParams.of('scale'))]].length;
  let d = deg + dir;
  let o = oct;
  if (d < 0) {
    if (o <= -1) return null;
    o -= 1;
    d += L;
  } else if (d > 20) {
    if (o >= 2) return null;
    o += 1;
    d -= L;
  }
  return { deg: d, oct: o };
}

/** La note jouee par un degre et une octave (le rouleau la nomme pendant le glisser). */
export const bassNoteName = (deg: number, oct: number): string => noteName(midiOf({ kind: 'note', deg, oct, acc: false, slide: false }));

/**
 * La note de la gamme la plus proche d'une hauteur MIDI (le rouleau d'EDIT : le pointeur la donne, 2026-10-09) ; a
 * hauteur egale, l'octave du pas d'avant (oct) puis le degre le plus bas : la facon d'ecrire la note change le moins.
 */
export function bassPitchAt(midi: number, oct = 0): { deg: number; oct: number } {
  let best = { deg: 0, oct: 0 };
  let score = Infinity;
  for (let o = -1; o <= 2; o += 1) {
    for (let d = 0; d <= 20; d += 1) {
      const m = midiOf({ kind: 'note', deg: d, oct: o, acc: false, slide: false });
      const sc = Math.abs(m - midi) * 100 + (o === oct ? 0 : 10 + Math.abs(o)) + d * 0.01;
      if (sc < score) {
        score = sc;
        best = { deg: d, oct: o };
      }
    }
  }
  return best;
}

/** Ce que montre un potard : le verrou du pas en LOCK, sinon sa valeur. */
export function bassKnobValue(id: BassKnobId): number {
  const st = bassState.get();
  if (st.lock >= 0 && isLockable(id)) {
    const v = st.steps[st.lock]?.locks?.[id];
    if (v !== undefined) return v;
  }
  return bassParams.of(id);
}

/** Les pas dont l'accent vient d'un verrou d'ACCENT (il s'en va avec le verrou). */
const accByLock = new Set<number>();
/** Le pas vide qui a recu une note en entrant en LOCK (-1 : aucun) : sans verrou ni retouche, il redevient vide. */
let lockNote = -1;
/** La suite vue a la derniere notification (pour reconnaitre une ligne remplacee d'un bloc). */
let seenSteps: readonly BassStep[] = bassState.get().steps;

/**
 * La ligne entiere a ete remplacee (un preset, un pattern, GEN, CLEAR) et non un pas retouche (setStep ne change que
 * le sien) : le pas i a change, et un autre aussi.
 */
function lineReplaced(prev: readonly BassStep[], next: readonly BassStep[], i: number): boolean {
  return next[i] !== prev[i] && next.some((s, k) => k !== i && s !== prev[k]);
}

bassState.subscribe(() => {
  const st = bassState.get();
  if (st.lock < 0) tapLock = -1;
  // Un verrou d'ACCENT parti (GEN, CLEAR, un pattern) : son accent n'est plus a reprendre
  for (const i of accByLock) if (st.steps[i]?.locks?.accent === undefined) accByLock.delete(i);
  const prev = seenSteps;
  seenSteps = st.steps;
  if (lockNote < 0) return;
  // Une autre ligne a pris la place (2026-10-09, la revue : un preset charge en LOCK perdait sa note a ce pas, la
  // tonique toute simple qu'on croyait la notre) : la note posee en entrant en LOCK n'est plus la, rien a reprendre
  if (prev !== st.steps && lineReplaced(prev, st.steps, lockNote)) {
    lockNote = -1;
    return;
  }
  if (st.lock === lockNote) return;
  const i = lockNote;
  lockNote = -1;
  const s = st.steps[i];
  if (s && s.kind === 'note' && !s.locks && s.deg === 0 && s.oct === 0 && !s.acc && !s.slide && s.src === undefined) bassState.setStep(i, emptyStep());
});

/** Les potards tournes en LOCK depuis le debut d'un appui tenu (un pas tenu qu'on lache apres un reglage sort du LOCK). */
let lockTurns = 0;
export const bassLockTurns = (): number => lockTurns;
/**
 * Chaque entree en LOCK et chaque sortie (2026-10-09, la revue) : un geste qui a remis sa sortie a plus tard (le pas
 * leve avant le bloc) sait si le LOCK a ete repris entre-temps (le meme pas tenu de nouveau, sa touche LOCK, le MIDI,
 * le clavier, le Roto) ; il ne sort alors plus rien.
 */
let lockGen = 0;
export const bassLockGen = (): number => lockGen;
let lockAudition = 0;
/**
 * Le pas dont le P-LOCK vient d'une tape (2026-10-09, la revue : choisir un pas sur l'ecran ou au clavier le met en
 * P-LOCK, l'etape 2) et pas d'un geste de LOCK (tenir le pas, sa touche LOCK, le MIDI bass:lock, le Roto tenu) ; -1 :
 * aucun. Tant que le P-LOCK ne vient que d'une tape, le Roto et les potards MIDI d'un reglage (bass:knob:cutoff...)
 * restent ce qu'ils etaient : une tape du Roto pose ou retire une note, un potard balaie le son de toute la ligne.
 * L'ecran, ses blocs et bass:knob:1 a 8 (le bloc k de la page) suivent le P-LOCK quel qu'il soit. Un LOCK pose ailleurs
 * puis rendu (bassLockRestore, le Roto) retrouve le sien : la valeur reste tant que ce pas n'a pas recu un geste de LOCK.
 */
let tapLock = -1;
export const bassTapLocked = (): boolean => {
  const l = bassState.get().lock;
  return l >= 0 && l === tapLock;
};

/**
 * Un reglage GLOBAL refuse en P-LOCK (2026-10-09) : l'ecran dit ou le regler, l'encodeur de la face qui le tient
 * (desktop), sinon sortir du P-LOCK (le telephone, ou il est sur l'ecran).
 */
function sayGlobal(id: BassKnobId, also: Partial<import('./state').BassState> = {}): void {
  const k = bassFxEncOf(id);
  const label = bassKnob(id).label;
  // Le potard par son nom serigraphie (la revue : KNOB C se lisait comme le bloc C de l'ecran, ENV MOD sur FILTER)
  const where = !PORTRAIT && k >= 0 ? `TURN THE ${label} KNOB` : 'EXIT P-LOCK TO SET IT';
  bassState.say(`${label} IS GLOBAL  ${where}`, 1800, also);
}

/** Un potard (0 a 1) ; l'ecran dit sa valeur. En LOCK, un potard du son verrouille le pas. */
export function bassDial(id: BassKnobId, v: number): void {
  const st = bassState.get();
  // En LOCK, un reglage GLOBAL d'une page (2026-10-08) : il ne bouge pas, l'ecran dit pourquoi
  if (st.lock >= 0 && isBassGlobal(id)) {
    sayGlobal(id, { touched: { id, at: performance.now() } });
    return;
  }
  if (st.lock >= 0 && isLockable(id)) {
    // Jamais un verrou NaN (2026-10-09, la meme garde que bassParams.set)
    if (!Number.isFinite(v)) return;
    // Un reglage a crans se verrouille sur un cran entier (SUB OCT)
    const n = bassKnob(id).steps ?? 0;
    const c = Math.min(1, Math.max(0, v));
    const x = n > 1 ? Math.round(c * (n - 1)) / (n - 1) : c;
    const s = st.steps[st.lock];
    if (s.locks?.[id] === x) return;
    lockTurns += 1;
    // ACCENT verrouille sur un pas sans accent : il le prend (sinon le verrou ne servirait a rien)
    const acc = id === 'accent' && s.kind === 'note' && !s.acc ? { acc: true } : {};
    if ('acc' in acc) accByLock.add(st.lock);
    bassState.setStep(st.lock, { ...acc, locks: { ...(s.locks ?? {}), [id]: x } }, { touched: { id, at: performance.now() } });
    bassState.say(`P-LOCK ${two(st.lock)}  ${bassKnob(id).label} ${bassValueText(id, x)}${'acc' in acc ? '  +ACC' : ''}`, 1400);
    // A l'arret, on entend le pas une fois le potard pose
    if (!bassSeq.running) {
      const step = st.lock;
      window.clearTimeout(lockAudition);
      lockAudition = window.setTimeout(() => {
        if (bassState.get().lock === step) audition(step);
      }, 160);
    }
    return;
  }
  dialLine(id, v);
}

/** Le son de toute la ligne (hors P-LOCK) ; tail : la fin du message. */
function dialLine(id: BassKnobId, v: number, tail = ''): void {
  const was = bassParams.of(id);
  if (!bassParams.set(id, v)) return;
  // L'echo et la ligne du bas dans la meme notification (2026-10-08, la revue : un dessin de l'ecran de moins par geste)
  const touched = { id, at: performance.now() };
  const label = `${bassKnob(id).label} ${bassValueText(id, bassParams.of(id))}`;
  // Le generateur (2026-10-09) : ses pas de la ligne se reecrivent a chaque cran
  if (GEN_LIVE.includes(id)) {
    regen(id, was, label);
    return;
  }
  bassState.say(`${label}${tail}`, 1400, { touched });
}

/**
 * Un potard MIDI d'un reglage (bass:knob:cutoff..., le setup BASS du Roto, sa page 4 du setup BSEQ ; la revue du
 * 2026-10-09) : en P-LOCK pose par une tape (bassTapLocked), le son de toute la ligne, comme avant l'etape 2 (un
 * balayage du filtre en direct ne devient pas le verrou du dernier pas tape) ; en LOCK pose par un geste de LOCK (le
 * pas du Roto tenu, sa touche LOCK), le verrou du pas, comme bassDial.
 */
export function bassKnobDial(id: BassKnobId, v: number): void {
  if (bassTapLocked() && (isLockable(id) || isBassGlobal(id))) {
    dialLine(id, v, '  ALL STEPS');
    return;
  }
  bassDial(id, v);
}

/** Ce que montre un potard MIDI d'un reglage (ses moteurs) : le son de la ligne en P-LOCK d'une tape, sinon bassKnobValue. */
export const bassKnobDialValue = (id: BassKnobId): number => (bassTapLocked() ? bassParams.of(id) : bassKnobValue(id));

/**
 * Ou DENSITY change le compte des notes, au-dessus et au-dessous du cran (2026-10-09, la revue : entre deux seuils, des
 * crans de suite semblaient ne rien faire) : MORE AT 82 · FEWER AT 70 ; les seuils sondes au centieme, depuis la ligne
 * telle qu'elle est (les memes pas libres, la meme recette).
 */
function densityMarks(line: readonly BassStep[], seed: number, base: number | null, opts: RegenOpts, n: number): string {
  const d = Math.round(bassParams.of('density') * 100);
  const o = genOpts();
  const count = (k: number): number => noteCount(regenerate(line, { ...o, density: k / 100, seed }, base, opts));
  let up = -1;
  for (let k = d + 1; k <= 100; k += 1) {
    if (count(k) > n) {
      up = k;
      break;
    }
  }
  let down = -1;
  for (let k = d - 1; k >= 0; k -= 1) {
    if (count(k) < n) {
      down = k;
      break;
    }
  }
  return `${up >= 0 ? `MORE AT ${up}` : 'THE MOST'} · ${down >= 0 ? `FEWER AT ${down}` : 'THE FEWEST'}`;
}

/** Deux suites qui jouent pareil (le contenu des pas, pas leur src ni leurs verrous). */
const sameLine = (a: readonly BassStep[], b: readonly BassStep[]): boolean =>
  a.every((s, i) => s.kind === b[i].kind && (s.kind === 'off' || (s.deg === b[i].deg && s.oct === b[i].oct && s.acc === b[i].acc && s.slide === b[i].slide)));

/**
 * Un cran de STYLE, DENSITY, SLIDE PROB, ACC PROB ou RANGE (2026-10-09) : les pas du generateur de la ligne se
 * reecrivent depuis sa graine (bass/gen.ts regenerate), les autres restent avec leurs P-locks. Une ligne sans recette
 * (une ligne d'avant) en recoit une, ancree ou elle est : son premier cran de DENSITY vers le haut y ajoute des notes,
 * vers le bas ne lui enleve rien. L'echo garde la ligne d'avant (before) : l'ecran montre ce qui est venu et parti.
 * La revue du meme jour :
 * - le pas en P-LOCK n'est jamais reecrit (ses verrous a venir tomberaient sur un vide, que DENSITY ne remplirait
 *   plus) ;
 * - un preset d'usine (recipe.anchor) : a son STYLE, sa ligne telle qu'ecrite a sa DENSITY, eclaircie au-dessous,
 *   des notes du style au-dessus ; a un autre STYLE, une ligne de ce style depuis sa graine ; l'ecran ne dit jamais
 *   YOUR NOTES pour des notes du preset ;
 * - le bas de l'echo dit ce que fait le cran (note) : la ligne suit, ou pourquoi elle ne bouge pas.
 */
function regen(id: BassKnobId, was: number, label: string): void {
  const st = bassState.get();
  const before = st.steps;
  const recipe: BassRecipe = st.recipe ?? { seed: newSeed(), base: id === 'density' ? was : bassParams.of('density') };
  const style = stepOf('style', bassParams.of('style'));
  const atPreset = !!recipe.anchor && stepOf('style', recipe.anchor.style) === style;
  // Un preset joue a un autre STYLE : la ligne du generateur de ce style (base null), depuis la graine du preset
  const base = recipe.anchor && !atPreset ? null : recipe.base;
  const regenOpts: RegenOpts = { keep: st.lock >= 0 ? [st.lock] : [], anchor: atPreset ? recipe.anchor?.steps : null };
  const steps = regenerate(before, { ...genOpts(), seed: recipe.seed }, base, regenOpts);
  // Rien n'a bouge : la ligne garde son objet (un preset nomme reste nomme, les patterns ne re-ecrivent rien)
  const same = sameLine(steps, before);
  const next = { ...recipe, gen: genSnap() };
  const line = same ? before : steps;
  const mine = handNotes(line);
  const n = noteCount(line);
  const sub = genOpts().style === 'SUB';
  const preset = atPreset && !!recipe.anchor && sameLine(line, recipe.anchor.steps);
  let text = label;
  if (id === 'density') text = `${label}  ${n} ${sub ? 'CHANGES' : 'NOTES'} / BAR`;
  else if (id === 'style') text = `STYLE ${BASS_STYLES[style]}  GATE ${Math.round(GATE[BASS_STYLES[style]] * 100)} %`;
  if (preset) text += '  THE PRESET LINE';
  else if (mine > 0) text += '  YOUR NOTES KEPT';
  // Le bas de l'echo : ce que fait le cran. Une ligne a toi sous sa DENSITY : ce qui y ajoute des notes ; DENSITY : ou la
  // ligne gagne et perd sa prochaine note (la course entre deux notes se lit, plus de cran qui semble ne rien faire) ;
  // les autres : la ligne suit, ou ne bouge pas a ce cran
  const d = bassParams.of('density');
  let note: string;
  if (base !== null && !recipe.anchor && d <= base + 1e-6 && (id === 'density' || id === 'style')) note = `YOUR LINE: DENSITY ABOVE ${Math.round(base * 100)} ADDS NOTES`;
  else if (id === 'density') note = densityMarks(line, recipe.seed, base, regenOpts, n);
  else if (!same) note = 'THE LINE FOLLOWS EACH NOTCH';
  else if (id === 'slides' || id === 'accents' || id === 'range') note = 'SAME LINE: ONLY ADDED NOTES FOLLOW IT';
  else note = 'SAME LINE AT THIS NOTCH';
  const touched = { id, at: performance.now(), before, note };
  if (same) bassState.say(text, 1800, { touched, recipe: next });
  else bassState.say(text, 1800, { steps, touched, recipe: next, gen: st.gen + 1 });
}

/** Deux tapes sur un potard : en LOCK, son verrou s'en va ; sinon, sa valeur de depart. */
export function bassDialReset(id: BassKnobId): void {
  const st = bassState.get();
  if (st.lock >= 0 && isBassGlobal(id)) {
    sayGlobal(id);
    return;
  }
  if (st.lock >= 0 && isLockable(id)) {
    const s = st.steps[st.lock];
    if (!s.locks || s.locks[id] === undefined) {
      bassState.say(`P-LOCK ${two(st.lock)}  ${bassKnob(id).label} NOT LOCKED`, 1400);
      return;
    }
    const { [id]: _gone, ...rest } = s.locks;
    // L'accent que ce verrou avait pose s'en va avec lui
    const acc = id === 'accent' && accByLock.delete(st.lock) ? { acc: false } : {};
    bassState.setStep(st.lock, { ...acc, locks: Object.keys(rest).length ? rest : undefined });
    bassState.say(`P-LOCK ${two(st.lock)}  ${bassKnob(id).label} UNLOCKED`, 1400);
    return;
  }
  // Le defaut du moteur qui sonne (2026-10-09) : celui de l'echelle, ou celui d'avant en MODE 303
  bassDial(id, bassParams.reset(id));
}

/* ---------------- les blocs de l'ecran et le MIDI bass:knob:1 a 8 (la page a l'ecran) ---------------- */

/** Le reglage du bloc k (0 a 7) de la page allumee ; null : une case vide. Le MIDI bass:knob:1 a 8 et le Roto s'en servent. */
export const bassEncParam = (k: number): BassKnobId | null => bassPage.slot(k);

/** Ce que montre le bloc k : le verrou du pas en P-LOCK, sinon le son ; 0 pour une case vide. */
export const bassEncValue = (k: number): number => {
  const id = bassEncParam(k);
  return id ? bassKnobValue(id) : 0;
};

/** Le grand dessin d'ENV (ses cases F G H) : ce qui le change, les cinq blocs a sa gauche (la revue : E, LENGTH, aussi). */
export const ENV_PICTURE = 'AMP ENV PICTURE: DRAG A B C D E';
/** Le grand dessin du contour du filtre (CONTOUR G H, 2026-10-09) : les six blocs a sa gauche le changent. */
export const CONTOUR_PICTURE = 'CONTOUR PICTURE: DRAG A TO F';

/** Ce que dit une case sans reglage (le grand dessin d'ENV ou de CONTOUR, une case vide). */
export function bassEmptySay(k: number): void {
  const s = bassPage.screen();
  bassState.say(s === 'env' && k >= 5 ? ENV_PICTURE : s === 'contour' && k >= 6 ? CONTOUR_PICTURE : `${'ABCDEFGH'[k] ?? ''}: EMPTY ON ${screenTitle(s)}`, 1200);
}

/** Le bloc k regle (0 a 1, la valeur voulue) : le reglage de la page, ou son verrou en P-LOCK. */
export function bassEncDial(k: number, v: number): void {
  const id = bassEncParam(k);
  if (!id) {
    bassEmptySay(k);
    return;
  }
  bassDial(id, v);
}

/** Deux tapes sur le bloc k : en P-LOCK son verrou s'en va, sinon sa valeur de depart. */
export function bassEncReset(k: number): void {
  const id = bassEncParam(k);
  if (id) bassDialReset(id);
}

/* ---------------- les encodeurs de la face : les FX globaux (2026-10-09) ---------------- */

/** Le reglage de l'encodeur k de la face (0 a 7), toujours le meme (bass/pages.ts BASS_FX_KNOBS). */
export const bassFxParam = (k: number): BassKnobId | null => BASS_FX_KNOBS[k] ?? null;

/**
 * L'encodeur k de la face tourne (0 a 1) : le son global, jamais un verrou, meme en P-LOCK (2026-10-09, Mika : "ils
 * ne servent qu'a faire les modifs des FX globaux de la machine") ; l'ecran le montre dans une bulle (touched.enc).
 */
export function bassFxDial(k: number, v: number): void {
  const id = bassFxParam(k);
  if (!id) return;
  const touched = { id, at: performance.now(), enc: k };
  if (!bassParams.set(id, v)) {
    // Deja au bout : la bulle reste (on voit pourquoi rien ne bouge)
    bassState.set({ touched });
    return;
  }
  bassState.say(`${bassKnob(id).label} ${bassValueText(id, bassParams.of(id))}  GLOBAL`, 1400, { touched });
}

/** Deux tapes sur un encodeur de la face : sa valeur de depart (globale, celle du moteur qui sonne). */
export function bassFxReset(k: number): void {
  const id = bassFxParam(k);
  if (id) bassFxDial(k, bassParams.reset(id));
}

/**
 * Une touche de page : l'ecran montre cette page ; en P-LOCK, il dit ses verrous sur le pas. La page deja allumee :
 * rien ne change (2026-10-08, la revue : un potard MIDI sur bass:page envoie un flot de CC, chacun effacait l'echo et
 * re-ecrivait la ligne du LOCK).
 */
export function bassPageSet(p: BassPageId): void {
  gesture();
  // PRESETS ouvert (2026-10-09, la revue) : une touche de page le referme et montre sa page, comme une touche de page
  // quitte le menu d'une Elektron (sinon la page changeait derriere le navigateur, sans que rien ne se voie)
  if (presetMode.on('bass')) presetMode.close();
  if (p === bassPage.get()) return;
  // La page change : l'echo du dernier reglage tourne s'en va avant (sinon l'ecran le montrerait en plein, hors de la page)
  if (bassState.get().touched) bassState.set({ touched: null });
  bassPage.set(p);
  sayScreenLocks();
}

/** En P-LOCK, l'ecran qui s'affiche dit ses verrous sur le pas (ou le geste pour en poser). */
function sayScreenLocks(): void {
  const st = bassState.get();
  if (st.lock < 0) return;
  const s = bassPage.screen();
  const locks = st.steps[st.lock]?.locks ?? {};
  const n = BASS_SCREEN_SLOTS[s].filter((id) => id !== null && isLockable(id) && locks[id] !== undefined).length;
  const name = PAGE_TABS[bassPage.get()].length > 1 ? `${bassPageDef(bassPage.get()).label} ${SCREEN_LABEL[s]}` : bassPageDef(bassPage.get()).label;
  bassState.say(`P-LOCK ${two(st.lock)}  ${name}: ${n ? `${n} P-LOCK${n > 1 ? 'S' : ''}` : TURN}`, 1400);
}

/**
 * Une touche de page PRESSEE (2026-10-09, les onglets : la touche 3D, sa jumelle sous l'ecran du telephone, son onglet
 * de l'en-tete, bass:page:<id>, les touches de page du Roto) : une autre page s'affiche sur son onglet retenu ; la page
 * allumee pressee encore passe a son onglet suivant (VOICE : MAIN, OSC, MIX ; FILTER : MAIN, CONTOUR), en boucle, comme
 * les sous-pages d'une Digitakt II. La valeur MIDI bass:page (un flot de CC) passe par bassPageSet, jamais par ici.
 */
export function bassPagePress(p: BassPageId): void {
  gesture();
  if (presetMode.on('bass')) presetMode.close();
  const before = bassPage.screen();
  if (bassState.get().touched) bassState.set({ touched: null });
  const s = bassPage.press(p);
  if (s === before) return;
  // L'onglet nomme un instant quand il change sur la meme page (la puce de l'en-tete le montre aussi)
  if (bassState.get().lock >= 0) sayScreenLocks();
  else if (p === bassPage.get() && PAGE_TABS[p].length > 1) bassState.say(`${bassPageDef(p).label}  ${SCREEN_LABEL[s]}: ${screenTitle(s)}`, 1000);
}

/** Un ecran (une puce de l'en-tete, le MIDI bass:screen:<id>) : sa page s'affiche, sur lui. */
export function bassScreenSet(s: BassScreenId): void {
  gesture();
  if (presetMode.on('bass')) presetMode.close();
  if (s === bassPage.screen()) return;
  if (bassState.get().touched) bassState.set({ touched: null });
  bassPage.setScreen(s);
  sayScreenLocks();
}

/** Les touches [ et ] : la page d'a cote (un seul changement, l'echo efface avant). */
export function bassPageStep(dir: -1 | 1): void {
  const n = BASS_PAGES.length;
  const i = BASS_PAGES.findIndex((x) => x.id === bassPage.get());
  bassPageSet(BASS_PAGES[(((i < 0 ? 0 : i) + dir) % n + n) % n].id);
}

/** Maj + [ et ] (2026-10-09) : l'onglet d'a cote dans la page, en boucle. */
export function bassTabStep(dir: -1 | 1): void {
  gesture();
  if (bassState.get().touched) bassState.set({ touched: null });
  const before = bassPage.screen();
  bassPage.tabStep(dir);
  if (bassPage.screen() !== before) sayScreenLocks();
}

/* ---------------- LOCK : les boutons au-dessus des pas ---------------- */

/** Un bouton LOCK : ce pas recoit les potards du son (le meme : on sort). */
export function bassLockTap(i: number): void {
  if (bassState.get().lock === i && !bassEditing()) {
    bassLockOff();
    return;
  }
  bassLockEnter(i);
}

/**
 * LOCK sur ce pas (un pas tenu, sa touche LOCK, le MIDI, le Roto) : les blocs de l'ecran ne regleront que lui ; on
 * l'entend a l'arret. EDIT ouvert (2026-10-09, l'etape 2) : EDIT se ferme et le P-LOCK se pose, d'un geste.
 */
export function bassLockEnter(i: number): void {
  gesture();
  if (i < 0 || i >= BASS_STEPS) return;
  const closed = bassEditing();
  if (closed) editor.close();
  const st = bassState.get();
  lockTurns = 0;
  lockGen += 1;
  if (tapLock === i) tapLock = -1;
  // Un pas vide : une note (la tonique), sinon son verrou ne s'entendrait jamais ; elle repart si on quitte
  // le pas sans rien y verrouiller (2026-10-08 : promener le LOCK sur des pas vides remplissait la ligne)
  const empty = st.steps[i].kind === 'off';
  bassState.set({ lock: i, sel: i });
  if (empty) {
    bassState.setStep(i, { kind: 'note', deg: 0, oct: 0, acc: false, slide: false, src: undefined });
    lockNote = i;
  }
  const n = Object.keys(st.steps[i].locks ?? {}).length;
  bassState.say(`${closed ? 'EDIT CLOSED, ' : ''}P-LOCK ${two(i)}  ${empty ? `NEW NOTE, ${TURN}` : n ? `${n} P-LOCK${n > 1 ? 'S' : ''}` : TURN}`, 2000);
  audition(i);
}

/** LOCK sur le pas choisi (clavier L, MIDI). */
export function bassLockToggle(): void {
  bassLockTap(bassState.get().sel);
}

export function bassLockOff(): void {
  if (bassState.get().lock < 0) return;
  lockGen += 1;
  bassState.set({ lock: -1 });
  // Au telephone, les blocs reglent de nouveau toute la ligne (2026-10-09) : l'ecran le dit
  bassState.say('P-LOCK OFF  VALUES: THE WHOLE LINE', 1400);
}

/**
 * La fin d'un LOCK momentane (un pas tenu, un bloc tourne, le pas lache ; 2026-10-09, l'etape 2) : le P-LOCK fixe
 * d'avant revient (prev, le pas qu'une tape avait choisi), sinon plus de P-LOCK.
 */
export function bassLockRestore(prev: number): void {
  const st = bassState.get();
  if (st.lock < 0) return;
  if (prev >= 0 && prev < BASS_STEPS && prev !== st.lock && !bassEditing() && st.steps[prev]?.kind !== 'off') {
    lockGen += 1;
    bassState.set({ lock: prev, sel: prev });
    bassState.say(`P-LOCK ${two(prev)}`, 1200);
    return;
  }
  if (prev === st.lock) return;
  bassLockOff();
}

/* ---------------- EDIT : les patterns ---------------- */

export function bassEditToggle(): void {
  gesture();
  editor.toggle('bass');
  const on = bassEditing();
  if (on && bassState.get().lock >= 0) bassState.set({ lock: -1 });
  bassState.say(on ? `PATTERNS  ${bassSlotName(bassPatterns.get().cur)}  DRAG A NOTE ON THE SCREEN` : 'EDIT CLOSED', 1800);
}

const chainLine = (c: readonly number[]): string => `CHAIN ${c.map(bassSlotName).join(' > ')}`;

export function bassPatternTap(i: number): void {
  const r = bassPatterns.tap(i, bassSeq.running);
  const p = bassPatterns.get();
  if (r === 'chain') bassState.say(chainLine(p.chain), 2600);
  else if (r === 'next') bassState.say(`NEXT ${bassSlotName(i)}: AT THE BAR`, 2000);
  else bassState.say(`PATTERN ${bassSlotName(i)}${bassPatterns.filled(i) ? '' : ' EMPTY'}`, 2000);
}

/** EDIT, un pas tenu : un emplacement vide recoit une copie de la ligne courante. */
export function bassPatternHold(i: number): void {
  const from = bassPatterns.get().cur;
  if (bassPatterns.copyTo(i)) bassState.say(`COPY ${bassSlotName(from)} > ${bassSlotName(i)}`, 2000);
  else bassState.say(i === from ? `${bassSlotName(i)} PLAYS` : !bassPatterns.filled(from) ? `${bassSlotName(from)} IS EMPTY` : 'HOLD AN EMPTY SLOT TO COPY', 2000);
}

// Une autre machine : LOCK se ferme (EDIT aussi, state/editor.ts)
focus.subscribe(() => {
  if (focus.get() !== 'bass' && bassState.get().lock >= 0) bassState.set({ lock: -1 });
});

/** Une piste du site qui part : la basse s'arrete. */
export function bassStop(): void {
  bassSeq.stop();
}

sc.subscribe(() => {
  if (sc.get().status === 'playing') bassSeq.stop();
});
