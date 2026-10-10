/**
 * Ce que font les commandes du MM-BASS (2026-10-07), pour la machine 3D, ses
 * jumeaux, le clavier et le MIDI :
 * - RUN : la sequence part sur la grille du MM-RYTM (ou du MM-ARP), ou s'arrete ;
 * - GEN : la prise suivante du style (bass/line.ts), le meme nombre de
 *   notes ; elle part si rien ne jouait ; tenu : la prise d'avant ;
 * - MUTATE : 2 ou 3 notes de la machine ; tenu : annule (plus sur la face
 *   depuis le 2026-10-09 au soir : le MIDI, le Roto) ; CLEAR : plus rien ;
 * - un pas (TRIG) : il est choisi ; taper le fait passer de vide a note, de
 *   note a liaison (TIE, s'il suit une note), de liaison a vide ; a l'arret,
 *   on entend sa note ;
 * - ACCENT, SLIDE, NOTE - +, OCT - + : sur le pas choisi (des touches de
 *   l'ecran depuis le 2026-10-09 au soir) ; PRESET : les presets a l'ecran ;
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
 * - GEN garde les P-locks des pas qui restent des notes.
 * Les prises et NOTES (2026-10-09, Mika : "Je trouve Style et Density
 * complexe a utiliser") : STYLE joue la prise 01 de chaque style, DENSITY
 * devient NOTES (0 a 16, un cran une note), GEN donne des prises numerotees
 * (tenu : la precedente), MUTATE s'annule (tenu) ; tout passe par bass/line.ts,
 * le seul a ecrire la ligne pour le generateur ; tes notes (une tape, un
 * glisser, un P-lock) restent, toujours. Plus de regen ni de MORE AT 82.
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

import { gesture, presetKey } from '../actions';
import { pattern } from '../audio/pattern';
import { sc } from '../audio/soundcloud';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { presetMode } from '../state/presetMode';
import { PORTRAIT } from '../theme';
import { bassEngine } from './engine';
import { isFreeStep } from './gen';
import { bassLine, styleName, takeLadder, type GenResult } from './line';
import type { BassState, BassStep } from './state';
import { BASS_SCALES, SCALE_TONES, bassKnob, bassParams, bassValueText, stepOf, type BassKnobId } from './params';
import { BASS_FX_KNOBS, BASS_PAGES, BASS_SCREEN_SLOTS, PAGE_TABS, SCREEN_LABEL, bassFxEncOf, bassPage, bassPageDef, isBassGlobal, screenTitle, type BassPageId, type BassScreenId } from './pages';
import { bassPatterns, bassSlotName } from './patterns';
import { bassSeq, gateOf, midiOf } from './seq';
import { BASS_STEPS, bassState, emptyStep, isLockable } from './state';

const two = (i: number): string => String(i + 1).padStart(2, '0');
/** Le geste qui regle un verrou : glisser un bloc de l'ecran, au telephone comme au desktop (2026-10-09, l'etape 2). */
const TURN = 'DRAG A VALUE';

/** EDIT est ouvert sur le MM-BASS : les pas sont les patterns. */
export const bassEditing = (): boolean => editor.get() === 'bass';

export function bassRun(): void {
  gesture();
  if (bassSeq.running) {
    bassSeq.stop();
    return;
  }
  void bassEngine.ensure().then(() => bassSeq.start());
}

/**
 * PRESET (2026-10-09, le soir, Mika : "rajoute un bouton PRESET") : les presets a l'ecran, comme une tape sur le
 * pattern de l'en-tete (A01) ; encore : fermes, comme EXIT.
 */
export function bassPresetKey(): void {
  presetKey('bass', presetMode.on('bass') ? 'exit' : 'open');
}

/* ---------------- le generateur : STYLE, NOTES, GEN, MUTATE, CLEAR (2026-10-09) ---------------- */

/** L'ecran GENERATOR apres GEN, MUTATE, leurs tenues, CLEAR (1.6 s ; STYLE et NOTES : tant qu'on les tient, puis 1.2 s). */
const GEN_MS = 1600;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
/** Le nom de la prise : DARK DISCO 02, ACID 07* (mutee), ACID 00 (une ligne d'avant les prises). */
export const bassTakeName = (): string => {
  const r = bassLine.get();
  return `${styleName(r.style)} ${String(r.take).padStart(2, '0')}${r.mutated ? '*' : ''}`;
};

/** Tes notes, quand rien de plus urgent n'est a dire (desktop : la place ; le telephone garde la ligne courte). */
function withYours(text: string): string {
  const n = bassLine.yours();
  if (!n || PORTRAIT) return text;
  return `${text} · YOUR ${n === 1 ? 'NOTE STAYS' : `${n} NOTES STAY`}`;
}

/** Ce que dit l'ecran GENERATOR quand le generateur ne peut rien faire (why). */
function refusal(res: Extract<GenResult, { ok: false }>): string {
  const st = bassState.get();
  switch (res.why) {
    case 'yours':
      return 'ALL 16 NOTES ARE YOURS · CLEAR TO START OVER';
    case 'ceiling':
      return `${plural(res.count, 'NOTE', 'NOTES')} · NO FREE STEP LEFT`;
    case 'floor': {
      const y = bassLine.yours();
      if (res.count === 0) return '0 NOTES · TURN UP: THE TAKE COMES BACK';
      if (y < res.count && st.lock >= 0) return `P-LOCK ${two(st.lock)} STAYS`;
      return y === 1 ? '1 NOTE IS YOURS · TAP IT OFF TO GO LOWER' : `${y} NOTES ARE YOURS · TAP ONE OFF TO GO LOWER`;
    }
    case 'first':
      return 'TAKE 01 IS THE FIRST';
    case 'old':
      return 'YOUR OLD LINE · GEN: TAKE 01';
    case 'none':
      return 'NO MACHINE NOTE TO MUTATE';
    case 'nothing':
      return 'NOTHING TO UNDO';
    default:
      return '';
  }
}

/** L'ecran GENERATOR montre ce geste : la ligne d'avant (les pas venus et partis), la ligne du bas ; gen : GEN, MUTATE, CLEAR. */
function showGen(id: BassKnobId, before: readonly BassStep[], note: string, gen = false): void {
  const touched: NonNullable<BassState['touched']> = { id, at: performance.now(), before, note, ...(gen ? { gen: true, ms: GEN_MS } : {}) };
  bassState.say(note || null, gen ? GEN_MS + 400 : 1800, { touched });
}

/** STYLE au cran s : sa prise 01 a son compte, ou ou tu l'avais laisse sur cette ligne ; un potard ne lance jamais la basse. */
export function bassStyleTo(s: number): void {
  const before = bassState.get().steps;
  const res = bassLine.style(s);
  const name = styleName(bassLine.get().style);
  let note: string;
  if (!res.ok) {
    // Le meme cran (un glisser entre deux crans) : l'ecran reste, rien ne change
    if (res.why === 'same') {
      const t = bassState.get().touched;
      bassState.set({ touched: { id: 'style', at: performance.now(), before: t?.before ?? before, note: t?.note ?? '' } });
      return;
    }
    note = refusal(res);
  } else note = withYours(res.first ? `THE TYPICAL ${name} LINE · GEN: ANOTHER TAKE` : `YOUR ${bassTakeName()} IS BACK`);
  showGen('style', before, note);
}

/** NOTES a n (un potard, le MIDI) : une note a la fois, jusqu'a n ou une limite (le plancher, le plafond). */
export function bassNotesTo(n: number): void {
  const before = bassState.get().steps;
  const target = Math.max(0, Math.min(BASS_STEPS, Math.round(n)));
  const c0 = bassLine.count();
  if (target === c0) {
    const t = bassState.get().touched;
    bassState.set({ touched: { id: 'density', at: performance.now(), before: t?.id === 'density' ? t.before ?? before : before, note: t?.id === 'density' ? t.note ?? '' : '' } });
    return;
  }
  const res = bassLine.notesTo(target);
  showGen('density', before, notesNote(res, bassLine.count() - c0));
}

/** La ligne du bas d'un cran de NOTES : +1 NOTE ON STEP 15, -1 NOTE (STEP 14), +3 NOTES ; ou pourquoi rien. */
function notesNote(res: GenResult, diff: number): string {
  if (!res.ok && diff === 0) return refusal(res);
  if (bassLine.count() === 0) return '0 NOTES · TURN UP: THE TAKE COMES BACK';
  if (Math.abs(diff) === 1 && res.ok && res.step !== undefined && res.step >= 0) return withYours(diff > 0 ? `+1 NOTE ON STEP ${res.step + 1}` : `-1 NOTE (STEP ${res.step + 1})`);
  return withYours(`${diff > 0 ? '+' : ''}${diff} NOTES`);
}

/** NOTES d'un cran (MIDI bass:notes:up / down). */
export function bassNotesStep(dir: 1 | -1): void {
  bassNotesTo(bassLine.count() + dir);
}

/** Le pied de la PAGE apres GEN, une fois l'ecran GENERATOR parti : ACID 08  9 NOTES (une fois). */
let footTimer = 0;
function footLater(): void {
  window.clearTimeout(footTimer);
  footTimer = window.setTimeout(() => bassState.say(`${bassTakeName()}  ${plural(bassLine.count(), 'NOTE', 'NOTES')}`, 2000), GEN_MS + 60);
}

/** GEN (une tape) : la prise suivante, le meme nombre de notes, P-LOCK quitte ; elle part si la basse ne jouait pas. */
export function bassGenerate(): void {
  gesture();
  const before = bassState.get().steps;
  const res = bassLine.gen(1, { lock: -1 });
  showGen('density', before, res.ok ? withYours(`NEW TAKE · SAME ${plural(res.count, 'NOTE', 'NOTES')} · HOLD GEN: BACK`) : refusal(res), true);
  if (res.ok) footLater();
  if (!bassSeq.running) void bassEngine.ensure().then(() => bassSeq.start());
}

/** GEN tenu 500 ms : la prise d'avant (arret a 01), le meme nombre de notes. */
export function bassGenBack(): void {
  gesture();
  const before = bassState.get().steps;
  const res = bassLine.gen(-1, { lock: -1 });
  showGen('density', before, res.ok ? withYours(`BACK TO TAKE ${String(bassLine.get().take).padStart(2, '0')}`) : refusal(res), true);
}

/** MUTATE (une tape) : 2 ou 3 notes de la machine, le meme compte ; la prise prend une etoile. */
export function bassMutate(): void {
  gesture();
  const before = bassState.get().steps;
  const res = bassLine.mutate();
  showGen('density', before, res.ok ? `${plural(res.mutated ?? 2, 'NOTE', 'NOTES')} CHANGED · HOLD MUTATE: UNDO` : refusal(res), true);
}

/** MUTATE tenu 500 ms : la derniere mutation s'annule. */
export function bassMutateUndo(): void {
  gesture();
  const before = bassState.get().steps;
  const res = bassLine.undo();
  showGen('density', before, res.ok ? 'MUTATION UNDONE' : refusal(res), true);
}

/** Une mutation a annuler (la LED de MUTATE, le MIDI). */
export const bassCanUndo = (): boolean => bassLine.canUndo();

/** Deux tapes sur STYLE : la ligne typique du style (sa prise 01, a son compte). */
function bassStyleHome(): void {
  const before = bassState.get().steps;
  const r = bassLine.get();
  if (r.take === 1 && !r.mutated) {
    const own = takeLadder(r.style, 1).on;
    if (r.on === own) {
      showGen('style', before, withYours(`THE TYPICAL ${styleName(r.style)} LINE · GEN: ANOTHER TAKE`));
      return;
    }
  }
  // Une autre prise : la 01 a son compte (GEN en arriere jusqu'a 01, puis son compte)
  const res = bassLine.home();
  showGen('style', before, res.ok ? withYours(`THE TYPICAL ${styleName(r.style)} LINE · GEN: ANOTHER TAKE`) : refusal(res));
}

/** Deux tapes sur NOTES : le nombre de notes de la prise. */
function bassNotesHome(): void {
  const r = bassLine.get();
  const t = takeLadder(r.style, Math.max(1, r.take));
  bassNotesTo(r.take === 0 ? bassLine.count() : bassLine.countAt(t.on));
}

export function bassClear(): void {
  // En P-LOCK : les verrous du pas seulement (une note de la machine qui n'avait que des verrous lui revient et joue)
  const st = bassState.get();
  if (st.lock >= 0) {
    // L'accent pose par un verrou d'ACCENT s'en va avec les verrous
    bassLine.edit(st.lock, { ...(accByLock.delete(st.lock) ? { acc: false } : {}), locks: undefined });
    bassState.say(`P-LOCK ${two(st.lock)} CLEARED`, 1400);
    return;
  }
  // Tout s'efface, tes notes comprises : NOTES a 0 ; l'echelle, la prise et le style restent (NOTES remonte la prise)
  const before = st.steps;
  bassLine.clear();
  showGen('density', before, 'CLEARED · TURN NOTES UP: THE TAKE COMES BACK', true);
}

/**
 * Un geste a la main qui change le compte pendant que l'ecran GENERATOR est la (2026-10-09) : il reste 1.6 s, il
 * montre la note venue ou partie (NOTES bouge tout seul, le miroir de la ligne).
 */
function afterEdit(before: readonly BassStep[]): void {
  const st = bassState.get();
  const t = st.touched;
  if (!t || (t.id !== 'style' && t.id !== 'density') || performance.now() - t.at > (t.ms ?? 1200)) return;
  const n0 = before.filter((x) => x.kind === 'note').length;
  const n = bassLine.count();
  if (n === n0) return;
  bassState.set({ touched: { id: 'density', at: performance.now(), before, note: withYours(`${n > n0 ? '+' : ''}${n - n0} NOTE${Math.abs(n - n0) > 1 ? 'S' : ''} · ${plural(n, 'NOTE', 'NOTES')}`), gen: true, ms: GEN_MS } });
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
 * Taper un pas (2026-10-10, Mika : "tout est en p-locks") : comme un sequenceur, une tape pose la note (la tonique) sur
 * un pas vide, enleve celle d'un pas plein ; un P-LOCK en cours s'en va. Le P-LOCK : tenir le pas (gestures.ts).
 * En EDIT aussi (2026-10-10) : les patterns se choisissent sur l'ecran.
 */
export function bassStepTap(i: number): void {
  gesture();
  const st = bassState.get();
  if (i < 0 || i >= BASS_STEPS) return;
  const s = st.steps[i];
  if (st.lock >= 0) lockGen += 1;
  if (s.kind === 'off') {
    bassLine.edit(i, hand({ kind: 'note', deg: 0, oct: 0, acc: false, slide: false }));
    bassState.set({ lock: -1, sel: i });
    afterEdit(st.steps);
    sayStep(i);
    audition(i);
    return;
  }
  bassLine.edit(i, hand({ kind: 'off' }));
  bassState.set({ lock: -1, sel: i });
  afterEdit(st.steps);
  bassState.say(`STEP ${two(i)}  OFF`, 1600);
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
  const before = bassState.get().steps;
  const s = before[i];
  if (!s) return;
  const on = s.kind === 'off';
  bassLine.edit(i, hand(on ? { kind: 'note', deg: 0, oct: 0 } : { kind: 'off' }), { sel: i });
  afterEdit(before);
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
  bassLine.edit(i, hand({ kind: 'note', deg: d }));
  afterEdit(st.steps);
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
  bassLine.edit(st.sel, hand({ acc: !s.acc }));
  sayStep(st.sel);
}

export function bassSlide(): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassLine.edit(st.sel, hand({ slide: !s.slide }));
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
  bassLine.edit(st.sel, hand({ deg: Math.max(0, Math.min(20, s.deg + dir)) }));
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
  bassLine.edit(st.sel, hand({ oct: Math.max(-1, Math.min(2, s.oct + dir)) }));
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
  bassLine.edit(i, hand({ kind: 'note', deg: d, oct: o }), { sel: i });
  const now = bassState.get().steps[i];
  bassState.say(`STEP ${two(i)}  ${noteName(midiOf(now))}`, 1400);
  audition(i);
}

/**
 * La longueur de la ligne, 1 a 16 pas (2026-10-10, Mika : "je ne sais pas comment on fait pour changer la longueur du
 * sequenceur, par exemple je voudrais 4 steps ; je clique sur EDIT, je pensais voir ca la") : la barre LENGTH de l'ecran
 * EDIT ; la sequence boucle sur les n premiers pas (les autres restent ecrits, eteints).
 */
export function bassLenSet(n: number): void {
  if (!Number.isFinite(n)) return;
  const len = Math.max(1, Math.min(BASS_STEPS, Math.round(n)));
  if (len === bassState.get().len) return;
  bassState.say(`LENGTH ${len} STEP${len > 1 ? 'S' : ''}`, 1400, { len });
}

/** Une tape sur une note du rouleau : note, liaison (apres une note), vide ; une liaison : vide. */
export function bassEditCycle(i: number): void {
  const st = bassState.get();
  const s = st.steps[i];
  if (!s || s.kind === 'off') return;
  const prev = st.steps[(i + BASS_STEPS - 1) % BASS_STEPS];
  const kind = s.kind === 'note' && prev.kind !== 'off' ? 'tie' : 'off';
  bassLine.edit(i, hand({ kind }), { sel: i });
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
  if (s && s.kind === 'note' && !s.locks && s.deg === 0 && s.oct === 0 && !s.acc && !s.slide && s.src === undefined) bassLine.edit(i, emptyStep());
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
  // STYLE et NOTES (2026-10-09) : le generateur, jamais un verrou ; le potard est le miroir de la ligne
  if (id === 'style' || id === 'density') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const c = Math.min(1, Math.max(0, v));
    if (id === 'style') bassStyleTo(stepOf('style', c));
    else bassNotesTo(Math.round(c * BASS_STEPS));
    return;
  }
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
    bassLine.edit(st.lock, { ...acc, locks: { ...(s.locks ?? {}), [id]: x } }, { touched: { id, at: performance.now() } });
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
  // SLIDE PROB, ACC PROB, RANGE (2026-10-09) : les notes de la machine suivent a chaque cran (leurs tirages), les
  // tiennes et les notes ecrites d'un preset gardent les leurs
  if (id === 'slides' || id === 'accents' || id === 'range') {
    const before = bassState.get().steps;
    bassLine.rerender();
    bassState.say(`${label}${tail}`, 1400, { touched: { ...touched, before, note: 'MACHINE NOTES FOLLOW · YOURS STAY' } });
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

/** Deux tapes sur un potard : en LOCK, son verrou s'en va ; sinon, sa valeur de depart. */
export function bassDialReset(id: BassKnobId): void {
  if (id === 'style') {
    bassStyleHome();
    return;
  }
  if (id === 'density') {
    bassNotesHome();
    return;
  }
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
    bassLine.edit(st.lock, { ...acc, locks: Object.keys(rest).length ? rest : undefined });
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
    bassLine.edit(i, { kind: 'note', deg: 0, oct: 0, acc: false, slide: false, src: undefined });
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
  bassState.say(on ? `EDIT ${bassSlotName(bassPatterns.get().cur)}  CLICK THE GRID: A NOTE` : 'EDIT CLOSED', 1800);
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
