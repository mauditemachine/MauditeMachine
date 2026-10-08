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
 * - en LOCK, taper un autre pas y deplace le verrou (il ne change plus sa
 *   note), taper le pas regle sort ;
 * - tenir un pas (350 ms, sans glisser) le verrouille, comme une Elektron :
 *   un potard tourne pendant l'appui, et le lacher sort (au doigt, deux
 *   doigts) ; sans potard tourne, le LOCK reste (a la souris : appui long,
 *   lacher, tourner) ;
 * - ACCENT verrouille sur un pas sans accent lui donne l'accent.
 * Le generateur repond a ses potards (2026-10-08, "pour qu'on ne cherche pas
 * les choses") : tant que la ligne n'a pas ete touchee depuis GEN, tourner
 * STYLE, DENSITY, SLIDE PROB, ACC PROB ou RANGE la reecrit avec le meme
 * tirage (on entend le potard) ; une ligne retouchee ne bouge plus, l'ecran
 * dit PRESS GEN.
 *
 * La machine Elektron (2026-10-08, Mika : "quand on clique sur un step on
 * selectionne la partie qu'on veut modifier, est-ce que le voice, est-ce que
 * le FX, est-ce que l'enveloppe, et ensuite on tourne un encodeur sur ce
 * step") : les huit encodeurs reglent la page allumee (bass/pages.ts) ; en
 * LOCK, un encodeur verrouille son reglage sur le pas (un cran entier pour
 * un reglage a crans), deux tapes l'en retirent ; un reglage GLOBAL (OCTAVE,
 * les reglages des effets) ne bouge pas en LOCK et l'ecran le dit, jamais un
 * geste qui ne fait rien en silence.
 */

import { gesture } from '../actions';
import { pattern } from '../audio/pattern';
import { sc } from '../audio/soundcloud';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { bassEngine } from './engine';
import { generate, mutate, type GenOpts } from './gen';
import type { BassStep } from './state';
import { BASS_SCALES, BASS_STYLES, SCALE_TONES, bassKnob, bassParams, bassValueText, stepOf, type BassKnobId } from './params';
import { BASS_PAGES, BASS_PAGE_SLOTS, bassPage, bassPageDef, isBassGlobal, type BassPageId } from './pages';
import { bassPatterns, bassSlotName } from './patterns';
import { bassSeq, gateOf, midiOf } from './seq';
import { BASS_STEPS, bassState, emptyStep, isLockable } from './state';

const two = (i: number): string => String(i + 1).padStart(2, '0');

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

export function bassRun(): void {
  gesture();
  if (bassSeq.running) {
    bassSeq.stop();
    return;
  }
  void bassEngine.ensure().then(() => bassSeq.start());
}

/** Un tirage qu'on peut refaire (mulberry32) : la ligne de GEN, reecrite par les potards du generateur. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le tirage de la derniere ligne de GEN, et cette ligne (tant que la suite est elle, les potards du generateur la reecrivent). */
let genSeed = 0;
let genLine: readonly BassStep[] | null = null;
const GEN_LIVE: readonly BassKnobId[] = ['style', 'density', 'slides', 'accents', 'range'];
/** La ligne est-elle encore celle du dernier GEN ? (ses potards la reecrivent en direct ; sinon il faut GEN) */
export const bassGenLive = (): boolean => genLine !== null && bassState.get().steps === genLine;

function writeGen(): string {
  const o = genOpts();
  const steps = generate({ ...o, rnd: seeded(genSeed) });
  genLine = steps;
  bassState.set({ steps, gen: bassState.get().gen + 1 });
  return o.style;
}

/** GEN : une ligne neuve ; elle part si la basse ne jouait pas. */
export function bassGenerate(): void {
  gesture();
  genSeed = Math.floor(Math.random() * 4294967296);
  const style = writeGen();
  bassState.set({ sel: 0 });
  bassState.say(`${style} LINE`, 1600);
  if (!bassSeq.running) void bassEngine.ensure().then(() => bassSeq.start());
}

export function bassMutate(): void {
  gesture();
  bassState.set({ steps: mutate(bassState.get().steps, genOpts()), gen: bassState.get().gen + 1 });
  bassState.say('MUTATED', 1200);
}

export function bassClear(): void {
  // En LOCK : les verrous du pas seulement
  const st = bassState.get();
  if (st.lock >= 0) {
    // L'accent pose par un verrou d'ACCENT s'en va avec les verrous
    bassState.setStep(st.lock, { ...(accByLock.delete(st.lock) ? { acc: false } : {}), locks: undefined });
    bassState.say(`LOCK ${two(st.lock)} CLEARED`, 1400);
    return;
  }
  bassState.set({ steps: Array.from({ length: BASS_STEPS }, emptyStep) });
  bassState.say('CLEARED', 1200);
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

function sayStep(i: number): void {
  const s = bassState.get().steps[i];
  const what = s.kind === 'off' ? 'OFF' : s.kind === 'tie' ? 'TIE' : `${noteName(midiOf(s))}${s.acc ? '  ACC' : ''}${s.slide ? '  SLIDE' : ''}`;
  bassState.say(`STEP ${String(i + 1).padStart(2, '0')}  ${what}`, 1600);
}

/** Taper un pas : choisi ; vide, note, liaison (apres une note), vide. En EDIT : son pattern. En LOCK : le verrou y va. */
export function bassStepTap(i: number): void {
  gesture();
  if (bassEditing()) {
    bassPatternTap(i);
    return;
  }
  const st = bassState.get();
  if (i < 0 || i >= BASS_STEPS) return;
  // En LOCK (2026-10-08) : un autre pas prend le verrou (sa note ne change pas) ; le pas regle sort
  if (st.lock >= 0) {
    if (i === st.lock) bassLockOff();
    else bassLockEnter(i);
    return;
  }
  const s = st.steps[i];
  const prev = st.steps[(i + BASS_STEPS - 1) % BASS_STEPS];
  if (st.sel !== i && s.kind !== 'off') {
    // Un pas plein qu'on choisit : seulement choisi (on l'entend), un second appui le change
    bassState.set({ sel: i });
    sayStep(i);
    audition(i);
    return;
  }
  const kind = s.kind === 'off' ? 'note' : s.kind === 'note' && prev.kind !== 'off' ? 'tie' : 'off';
  bassState.set({ sel: i });
  bassState.setStep(i, { kind, ...(kind === 'note' && s.kind === 'off' ? { deg: 0, oct: 0 } : {}) });
  sayStep(i);
  audition(i);
}

/** Glisser sur un pas : sa note dans la gamme (un pas vide devient une note). */
export function bassStepDeg(i: number, deg: number): void {
  const st = bassState.get();
  const s = st.steps[i];
  if (!s) return;
  const d = Math.max(0, Math.min(20, deg));
  if (s.kind === 'note' && s.deg === d && st.sel === i) return;
  bassState.set({ sel: i });
  bassState.setStep(i, { kind: 'note', deg: d });
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
  bassState.setStep(st.sel, { acc: !s.acc });
  sayStep(st.sel);
}

export function bassSlide(): void {
  const st = bassState.get();
  const s = st.steps[st.sel];
  if (s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  bassState.setStep(st.sel, { slide: !s.slide });
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
  bassState.setStep(st.sel, { deg: Math.max(0, Math.min(20, s.deg + dir)) });
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
  bassState.setStep(st.sel, { oct: Math.max(-1, Math.min(2, s.oct + dir)) });
  sayStep(st.sel);
  audition(st.sel);
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

bassState.subscribe(() => {
  const st = bassState.get();
  // Un verrou d'ACCENT parti (GEN, CLEAR, un pattern) : son accent n'est plus a reprendre
  for (const i of accByLock) if (st.steps[i]?.locks?.accent === undefined) accByLock.delete(i);
  if (lockNote < 0 || st.lock === lockNote) return;
  const i = lockNote;
  lockNote = -1;
  const s = st.steps[i];
  if (s && s.kind === 'note' && !s.locks && s.deg === 0 && s.oct === 0 && !s.acc && !s.slide) bassState.setStep(i, emptyStep());
});

/** Les potards tournes en LOCK depuis le debut d'un appui tenu (un pas tenu qu'on lache apres un reglage sort du LOCK). */
let lockTurns = 0;
export const bassLockTurns = (): number => lockTurns;
let lockAudition = 0;

/** Un potard (0 a 1) ; l'ecran dit sa valeur. En LOCK, un potard du son verrouille le pas. */
export function bassDial(id: BassKnobId, v: number): void {
  const st = bassState.get();
  // En LOCK, un reglage GLOBAL d'une page (2026-10-08) : il ne bouge pas, l'ecran dit pourquoi
  if (st.lock >= 0 && isBassGlobal(id)) {
    bassState.say(`${bassKnob(id).label}: GLOBAL, NOT PER STEP`, 1800, { touched: { id, at: performance.now() } });
    return;
  }
  if (st.lock >= 0 && isLockable(id)) {
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
    bassState.say(`LOCK ${two(st.lock)}  ${bassKnob(id).label} ${bassValueText(id, x)}${'acc' in acc ? '  +ACC' : ''}`, 1400);
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
  if (!bassParams.set(id, v)) return;
  // L'echo et la ligne du bas dans la meme notification (2026-10-08, la revue : un dessin de l'ecran de moins par geste)
  const touched = { id, at: performance.now() };
  const label = `${bassKnob(id).label} ${bassValueText(id, bassParams.of(id))}`;
  // Le generateur : la ligne de GEN se reecrit, sinon l'ecran dit comment l'entendre
  if (GEN_LIVE.includes(id)) {
    if (genLine && bassState.get().steps === genLine) {
      writeGen();
      bassState.say(label, 1400, { touched });
    } else bassState.say(`${label}   PRESS GEN`, 1800, { touched });
    return;
  }
  bassState.say(label, 1400, { touched });
}

/** Deux tapes sur un potard : en LOCK, son verrou s'en va ; sinon, sa valeur de depart. */
export function bassDialReset(id: BassKnobId): void {
  const st = bassState.get();
  if (st.lock >= 0 && isBassGlobal(id)) {
    bassState.say(`${bassKnob(id).label}: GLOBAL, NOT PER STEP`, 1800);
    return;
  }
  if (st.lock >= 0 && isLockable(id)) {
    const s = st.steps[st.lock];
    if (!s.locks || s.locks[id] === undefined) {
      bassState.say(`LOCK ${two(st.lock)}  ${bassKnob(id).label} NOT LOCKED`, 1400);
      return;
    }
    const { [id]: _gone, ...rest } = s.locks;
    // L'accent que ce verrou avait pose s'en va avec lui
    const acc = id === 'accent' && accByLock.delete(st.lock) ? { acc: false } : {};
    bassState.setStep(st.lock, { ...acc, locks: Object.keys(rest).length ? rest : undefined });
    bassState.say(`LOCK ${two(st.lock)}  ${bassKnob(id).label} OFF`, 1400);
    return;
  }
  bassDial(id, bassParams.def(id));
}

/* ---------------- les encodeurs et les pages (2026-10-08, la machine Elektron) ---------------- */

/** Le reglage de l'encodeur k (0 a 7) sur la page allumee ; null : une case vide. */
export const bassEncParam = (k: number): BassKnobId | null => bassPage.slot(k);

/** Ce que montre l'encodeur k : le verrou du pas en LOCK, sinon le son ; 0 pour une case vide. */
export const bassEncValue = (k: number): number => {
  const id = bassEncParam(k);
  return id ? bassKnobValue(id) : 0;
};

/** L'encodeur k tourne (0 a 1, la valeur voulue) : le reglage de la page, ou son verrou en LOCK. */
export function bassEncDial(k: number, v: number): void {
  const id = bassEncParam(k);
  if (!id) {
    bassState.say(`${'ABCDEFGH'[k] ?? ''}: EMPTY ON ${bassPageDef(bassPage.get()).label}`, 1200);
    return;
  }
  bassDial(id, v);
}

/** Deux tapes sur l'encodeur k : en LOCK son verrou s'en va, sinon sa valeur de depart. */
export function bassEncReset(k: number): void {
  const id = bassEncParam(k);
  if (id) bassDialReset(id);
}

/**
 * Une touche de page : les encodeurs reglent cette page ; en LOCK, l'ecran dit ses verrous sur le pas. La page deja
 * allumee : rien ne change (2026-10-08, la revue : un potard MIDI sur bass:page envoie un flot de CC, chacun effacait
 * l'echo et re-ecrivait la ligne du LOCK).
 */
export function bassPageSet(p: BassPageId): void {
  gesture();
  if (p === bassPage.get()) return;
  // La page change : l'echo du dernier reglage tourne s'en va avant (sinon l'ecran le montrerait en plein, hors de la page)
  if (bassState.get().touched) bassState.set({ touched: null });
  bassPage.set(p);
  const st = bassState.get();
  if (st.lock < 0) return;
  const locks = st.steps[st.lock]?.locks ?? {};
  const n = BASS_PAGE_SLOTS[p].filter((id) => id !== null && isLockable(id) && locks[id] !== undefined).length;
  bassState.say(`LOCK ${two(st.lock)}  ${bassPageDef(p).label}: ${n ? `${n} LOCKED` : 'TURN A KNOB'}`, 1400);
}

/** Les touches [ et ] : la page d'a cote (un seul changement, l'echo efface avant). */
export function bassPageStep(dir: -1 | 1): void {
  const n = BASS_PAGES.length;
  const i = BASS_PAGES.findIndex((x) => x.id === bassPage.get());
  bassPageSet(BASS_PAGES[(((i < 0 ? 0 : i) + dir) % n + n) % n].id);
}

/* ---------------- LOCK : les boutons au-dessus des pas ---------------- */

/** Un bouton LOCK : ce pas recoit les potards du son (le meme : on sort). */
export function bassLockTap(i: number): void {
  if (bassState.get().lock === i) {
    bassLockOff();
    return;
  }
  bassLockEnter(i);
}

/** LOCK sur ce pas (un pas tenu, un autre pas en LOCK) : les potards du son ne regleront que lui ; on l'entend a l'arret. */
export function bassLockEnter(i: number): void {
  gesture();
  if (i < 0 || i >= BASS_STEPS) return;
  if (bassEditing()) {
    bassState.say('CLOSE EDIT TO LOCK A STEP', 1600);
    return;
  }
  const st = bassState.get();
  lockTurns = 0;
  // Un pas vide : une note (la tonique), sinon son verrou ne s'entendrait jamais ; elle repart si on quitte
  // le pas sans rien y verrouiller (2026-10-08 : promener le LOCK sur des pas vides remplissait la ligne)
  const empty = st.steps[i].kind === 'off';
  bassState.set({ lock: i, sel: i });
  if (empty) {
    bassState.setStep(i, { kind: 'note', deg: 0, oct: 0, acc: false, slide: false });
    lockNote = i;
  }
  const n = Object.keys(st.steps[i].locks ?? {}).length;
  bassState.say(`LOCK ${two(i)}  ${empty ? 'NEW NOTE, TURN A KNOB' : n ? `${n} LOCKED` : 'TURN A KNOB'}`, 2000);
  audition(i);
}

/** LOCK sur le pas choisi (clavier L, MIDI). */
export function bassLockToggle(): void {
  bassLockTap(bassState.get().sel);
}

export function bassLockOff(): void {
  if (bassState.get().lock < 0) return;
  bassState.set({ lock: -1 });
  bassState.say('LOCK OFF', 1200);
}

/* ---------------- EDIT : les patterns ---------------- */

export function bassEditToggle(): void {
  gesture();
  editor.toggle('bass');
  const on = bassEditing();
  if (on && bassState.get().lock >= 0) bassState.set({ lock: -1 });
  bassState.say(on ? `PATTERNS  ${bassSlotName(bassPatterns.get().cur)}` : 'EDIT CLOSED', 1800);
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
