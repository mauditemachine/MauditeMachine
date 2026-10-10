/**
 * Les cibles MIDI du MM-BASS (2026-10-07, midi/targets.ts) : ses potards
 * (bass:knob:<id>, ceux de la plaque sous le capot compris depuis le
 * 2026-10-08), ses touches (bass:key:<touche>, EDIT et OPEN compris), INFOS
 * (bass:infos), RUN en bascule (bass:running, la LED suit), ses seize pas
 * (bass:trig:<0-15> : comme un appui sur le pas ; en EDIT, un pattern), leurs
 * seize LOCK (bass:lock:<0-15>) et LOCK sur le pas choisi (bass:lock), comme
 * sur une Elektron : un potard du son tourne pendant un LOCK ne change que
 * ce pas. Inscrites au chargement de son code (state/bassload.ts).
 * La machine Elektron (2026-10-08) : les huit encodeurs de la page allumee
 * (bass:knob:1 a 8, les memes que MIDI LEARN sur un encodeur de la face ; un
 * cran du controleur = un cran de l'ecran, cc / 127), les pages
 * (bass:page:voice, filter, env, fx, et bass:page en quatre crans), la
 * touche "i" (bass:key:i) ; les reglages des pages ont aussi leur cible
 * directe (bass:knob:pw, bass:knob:delay...). Les ids d'avant restent.
 * Le Roto en sequenceur (2026-10-09, le setup BSEQ, midi/seqlink.ts) :
 * bass:seq:<1-8> (les huit pas de la fenetre : taper, tenir, tourner),
 * bass:seq:window, bass:seq:follow, bass:seq:tie (la liaison du pas choisi) ;
 * le MM-BASS s'y inscrit ici (ses pas, son LOCK, les LEDs de ses touches).
 * L'etape 2 (2026-10-09, Mika : "en desktop les encoders ne servent qu'a
 * faire les modifs des FX globaux") : huit cibles de plus, bass:global:<id>
 * (DRIVE, DELAY, DLY TIME, DLY FB, VOLUME, REVERB, REV SIZE, REV TONE), le
 * reglage global, jamais un P-lock, meme en P-LOCK : MIDI LEARN sur un
 * encodeur de la face les donne. bass:knob:1 a 8 restent "le bloc k de la
 * page a l'ecran" (en P-LOCK, le verrou du pas : le Roto tient un pas et
 * tourne), bass:knob:<id> le reglage (en P-LOCK, son verrou). Aucune cible
 * d'avant ne change.
 * Le moteur MONARK (2026-10-09) : les dix-huit reglages nouveaux ont leur
 * bass:knob:<id> d'eux-memes (OSC 2, OSC 3, le melangeur, MODE, le contour) ;
 * bass:screen:<ecran> (une pression : voice osc mix filter contour env fx)
 * va a un onglet ; bass:page:<id> est une touche pressee (la page allumee
 * passe a son onglet suivant) ; bass:page (un flot de CC, quatre crans) ne
 * change jamais d'onglet.
 * La revue du meme jour : une tape sur un pas de l'ecran met le P-LOCK ;
 * tant qu'il ne vient que d'une tape (bassTapLocked), une tape du Roto sur un
 * pas pose ou retire sa note comme avant (le P-LOCK de l'ecran s'en va) et
 * bass:knob:<id> regle le son de toute la ligne (un balayage du filtre ne
 * devient pas le verrou du dernier pas tape) ; un LOCK pose par un geste de
 * LOCK (tenir le pas, sa touche LOCK, bass:lock, le Roto tenu) reste ce qu'il
 * etait. bass:knob:1 a 8 suivent le P-LOCK de l'ecran, quel qu'il soit.
 * Le generateur (2026-10-09, Mika : "Je trouve Style et Density complexe a
 * utiliser") : bass:knob:density devient NOTES (0 a 16, dix-sept crans ; set
 * demande round(v x 16) notes, une a la fois, dans les limites ; get = le
 * compte / 16 : une tape fait bouger le moteur) ; bass:knob:style suit la
 * ligne (pattern, preset). Nouvelles cibles : bass:gen:back et
 * bass:mutate:undo (une pression : la prise d'avant, annuler), bass:gen et
 * bass:mutate (tenir : une tape = la suivante / muter, 500 ms = la prise
 * d'avant / annuler, pour les boutons du Roto), bass:notes:up et
 * bass:notes:down (une note de plus ou de moins). LED bass:mutate : une
 * mutation a annuler. Les ids d'avant restent.
 */

import { registerTargets, type MidiTarget } from '../midi/targets';
import { seqFollow, seqPress, seqRegister, seqRelease, seqSetFollow, seqWindow, type SeqMachine } from '../midi/seqlink';
import { bassInfos } from '../state/bassInfos';
import { editor } from '../state/editor';
import { presetMode } from '../state/presetMode';
import { bassCanUndo, bassEditing, bassEncDial, bassEncParam, bassEncValue, bassFxDial, bassGenBack, bassGenerate, bassKnobDial, bassKnobDialValue, bassLockEnter, bassLockOff, bassLockTap, bassLockToggle, bassMutate, bassMutateUndo, bassNotesStep, bassPagePress, bassPageSet, bassPatternHold, bassPatternTap, bassRun, bassScreenSet, bassStepTap, bassStepToggle , bassLenSet } from './actions';
import { GEN_HOLD_MS, bassKeyAction } from './gestures';
import { bassLine } from './line';
import { BASS_FX_KNOBS, BASS_OLD_GLOBAL, BASS_PAGES, BASS_SCREENS, ENC_LETTERS, SCREEN_LABEL, SCREEN_PAGE, bassPage, bassPageDef } from './pages';
import { BASS_KNOBS, bassKnob, bassParams } from './params';
import { bassPatterns } from './patterns';
import { bassSeq } from './seq';
import { BASS_STEPS, bassState, isLockable } from './state';
import { BASS_KEY_COPY } from './theme';

function all(): MidiTarget[] {
  const out: MidiTarget[] = [];
  for (const k of BASS_KNOBS) {
    // En P-LOCK pose par une tape sur l'ecran : le son de toute la ligne (la revue du 2026-10-09, bassKnobDial) ; en LOCK
    // pose par un geste de LOCK (le pas du Roto tenu, sa touche LOCK) : le verrou du pas
    out.push({ id: `bass:knob:${k.id}`, scope: 'bass', label: k.id === 'density' ? 'NOTES (0 TO 16)' : k.label, kind: 'value', steps: k.steps ?? 0, get: () => bassKnobDialValue(k.id), set: (v) => bassKnobDial(k.id, v) });
  }
  // Le generateur (2026-10-09) : la prise d'avant, annuler, tenir GEN et MUTATE (le Roto), une note de plus ou de moins
  out.push({ id: 'bass:gen:back', scope: 'bass', label: 'GEN BACK (THE TAKE BEFORE)', kind: 'press', down: () => bassGenBack() });
  out.push({ id: 'bass:mutate:undo', scope: 'bass', label: 'MUTATE UNDO', kind: 'press', down: () => bassMutateUndo() });
  out.push(holdKey('bass:gen', 'GEN (TAP: NEXT TAKE, HOLD: THE TAKE BEFORE)', bassGenerate, bassGenBack));
  out.push(holdKey('bass:mutate', 'MUTATE (TAP: MUTATE, HOLD: UNDO)', bassMutate, bassMutateUndo));
  out.push({ id: 'bass:notes:up', scope: 'bass', label: 'NOTES +1', kind: 'press', down: () => bassNotesStep(1) });
  out.push({ id: 'bass:notes:down', scope: 'bass', label: 'NOTES -1', kind: 'press', down: () => bassNotesStep(-1) });
  // Les blocs de la page a l'ecran (les encodeurs de page d'avant le 2026-10-09) : leurs crans suivent le reglage qu'ils tiennent
  for (let i = 0; i < 8; i += 1) {
    out.push({
      id: `bass:knob:${i + 1}`,
      scope: 'bass',
      label: `SCREEN VALUE ${ENC_LETTERS[i]} (PAGE)`,
      kind: 'value',
      get steps() {
        const id = bassEncParam(i);
        return id ? bassKnob(id).steps ?? 0 : 0;
      },
      get: () => bassEncValue(i),
      set: (v) => bassEncDial(i, v),
    });
  }
  // Les encodeurs de la face (2026-10-09) : les FX globaux de la machine, jamais un P-lock
  BASS_FX_KNOBS.forEach((id, k) => {
    const def = bassKnob(id);
    out.push({ id: `bass:global:${id}`, scope: 'bass', label: `${def.label} (GLOBAL, KNOB ${ENC_LETTERS[k]})`, kind: 'value', steps: def.steps ?? 0, get: () => bassParams.of(id), set: (v) => bassFxDial(k, v) });
  });
  // Les FX que les encodeurs tenaient avant (2026-10-09) : leur cible reste, le reglage de toute la ligne
  for (const id of BASS_OLD_GLOBAL) {
    const def = bassKnob(id);
    out.push({ id: `bass:global:${id}`, scope: 'bass', label: `${def.label} (GLOBAL)`, kind: 'value', steps: def.steps ?? 0, get: () => bassParams.of(id), set: (v) => void bassParams.set(id, v) });
  }
  // Une touche de page pressee (2026-10-09) : la page allumee passe a son onglet suivant
  for (const p of BASS_PAGES) out.push({ id: `bass:page:${p.id}`, scope: 'bass', label: `PAGE ${p.label} (AGAIN: NEXT TAB)`, kind: 'press', down: () => bassPagePress(p.id) });
  // Un onglet (2026-10-09) : VOICE MAIN, OSC, MIX ; FILTER MAIN, CONTOUR ; ENV ; FX
  for (const s of BASS_SCREENS) out.push({ id: `bass:screen:${s}`, scope: 'bass', label: `SCREEN ${bassPageDef(SCREEN_PAGE[s]).label} ${SCREEN_LABEL[s]}`, kind: 'press', down: () => bassScreenSet(s) });
  // La longueur de la ligne (2026-10-10), 1 a 16 pas
  out.push({ id: 'bass:len', scope: 'bass', label: 'LENGTH (1 TO 16 STEPS)', kind: 'value', steps: 16, get: () => (bassState.get().len - 1) / 15, set: (v) => bassLenSet(1 + Math.round(v * 15)) });
  out.push({
    id: 'bass:page',
    scope: 'bass',
    label: 'PAGE (VOICE FILTER ENV FX)',
    kind: 'value',
    steps: BASS_PAGES.length,
    get: () => BASS_PAGES.findIndex((p) => p.id === bassPage.get()) / (BASS_PAGES.length - 1),
    set: (v) => bassPageSet(BASS_PAGES[Math.max(0, Math.min(BASS_PAGES.length - 1, Math.round(v * (BASS_PAGES.length - 1))))].id),
  });
  out.push({ id: 'bass:key:i', scope: 'bass', label: 'INFOS (THE i OF THE SCREEN)', kind: 'press', down: () => void bassInfos.toggle() });
  // Toutes les touches, celles de la face, celles de l'ecran (ACCENT... depuis le 2026-10-09 au soir) et MUTATE (plus
  // sur la face, le Roto s'en sert) ; PRESET ajoutee a la fin de la liste
  for (const k of BASS_KEY_COPY) out.push({ id: `bass:key:${k.kind}`, scope: 'bass', label: k.kind === 'run' ? 'RUN/STOP' : k.label, kind: 'press', down: () => bassKeyAction(k.kind) });
  out.push({
    id: 'bass:running',
    scope: 'bass',
    label: 'RUN (ON / OFF)',
    kind: 'value',
    steps: 2,
    get: () => (bassSeq.running ? 1 : 0),
    set: (v) => {
      if (v >= 0.5 !== bassSeq.running) bassRun();
    },
  });
  for (let i = 0; i < BASS_STEPS; i += 1) out.push({ id: `bass:trig:${i}`, scope: 'bass', label: `STEP ${i + 1}`, kind: 'press', down: () => bassStepTap(i) });
  for (let i = 0; i < BASS_STEPS; i += 1) out.push({ id: `bass:lock:${i}`, scope: 'bass', label: `LOCK ${i + 1}`, kind: 'press', down: () => bassLockTap(i) });
  out.push({ id: 'bass:lock', scope: 'bass', label: 'LOCK (CHOSEN STEP)', kind: 'press', down: () => bassLockToggle() });
  out.push({ id: 'bass:infos', scope: 'bass', label: 'INFOS (HELP ON HOVER)', kind: 'press', down: () => void bassInfos.toggle() });
  // Le sequenceur du Roto-Control (2026-10-09, midi/seqlink.ts) : les huit pas d'une fenetre (taper, tenir, tourner),
  // la fenetre 1-8 / 9-16, STEP FOLLOW, la liaison du pas choisi
  for (let b = 0; b < 8; b += 1) {
    out.push({ id: `bass:seq:${b + 1}`, scope: 'bass', label: `SEQ STEP ${b + 1}|${b + 9} (TAP, HOLD + TURN)`, kind: 'hold', down: () => seqPress('bass', b), up: () => seqRelease('bass', b) });
  }
  out.push({ id: 'bass:seq:window', scope: 'bass', label: 'SEQ STEPS 1-8 / 9-16', kind: 'press', down: () => seqWindow('bass') });
  out.push({ id: 'bass:seq:follow', scope: 'bass', label: 'SEQ STEP FOLLOW (THE STEPS FOLLOW THE PLAYHEAD)', kind: 'value', steps: 2, get: () => (seqFollow('bass') ? 1 : 0), set: (v) => seqSetFollow('bass', v >= 0.5) });
  out.push({ id: 'bass:seq:tie', scope: 'bass', label: 'TIE (THE CHOSEN STEP)', kind: 'press', down: () => bassTie() });
  return out;
}

const two = (i: number): string => String(i + 1).padStart(2, '0');

/**
 * Une touche tenue (2026-10-09, GEN et MUTATE sur un bouton du Roto) : lachee avant 500 ms, tap ; tenue 500 ms, hold,
 * a ce moment-la (sans attendre le lacher). L'heure de l'appui, comme midi/seqlink.ts.
 */
function holdKey(id: string, label: string, tap: () => void, hold: () => void): MidiTarget {
  let timer = 0;
  let fired = true;
  return {
    id,
    scope: 'bass',
    label,
    kind: 'hold',
    down: () => {
      window.clearTimeout(timer);
      fired = false;
      timer = window.setTimeout(() => {
        fired = true;
        hold();
      }, GEN_HOLD_MS);
    },
    up: () => {
      window.clearTimeout(timer);
      if (!fired) tap();
      fired = true;
    },
  };
}

/**
 * TIE (2026-10-09, le Roto en sequenceur) : le pas choisi (le pas en LOCK)
 * continue la note d'avant, comme le mode TIME de la 303 ; encore : il redevient
 * une note. Sur le Roto, une tape ne fait que vide ou note : la liaison passe
 * par ici.
 */
function bassTie(): void {
  const st = bassState.get();
  const i = st.lock >= 0 ? st.lock : st.sel;
  const s = st.steps[i];
  if (!s || s.kind === 'off') {
    bassState.say('PICK A NOTE STEP FIRST', 1400);
    return;
  }
  if (s.kind === 'note' && st.steps[(i + BASS_STEPS - 1) % BASS_STEPS].kind === 'off') {
    bassState.say(`STEP ${two(i)}  TIE: A NOTE BEFORE IT`, 1600);
    return;
  }
  const kind = s.kind === 'tie' ? 'note' : 'tie';
  bassLine.edit(i, { kind, src: 'hand' });
  bassState.say(`STEP ${two(i)}  ${kind === 'tie' ? 'TIE' : 'NOTE'}`, 1400);
}

/** Le pas que reglent ACCENT, SLIDE, TIE : le pas en LOCK, sinon le pas choisi. */
const focusStep = () => {
  const st = bassState.get();
  return st.steps[st.lock >= 0 ? st.lock : st.sel];
};

/** Le MM-BASS pour le sequenceur du Roto (midi/seqlink.ts, le setup BSEQ). */
const seq: SeqMachine = {
  editing: bassEditing,
  lit: (i) => (bassEditing() ? bassPatterns.filled(i) : (bassState.get().steps[i]?.kind ?? 'off') !== 'off'),
  current: () => bassPatterns.get().cur,
  lockStep: () => (bassEditing() ? -1 : bassState.get().lock),
  // Le LOCK du MM-BASS reste toujours au lacher (une tape le quitte)
  latched: () => (bassEditing() ? -1 : bassState.get().lock),
  running: () => bassSeq.running,
  subscribe(fn) {
    const offs = [bassState.subscribe(fn), bassPatterns.subscribe(fn), editor.subscribe(fn)];
    return () => offs.forEach((o) => o());
  },
  onStep: (fn) => bassSeq.onStep(fn),
  context: () => `${bassEditing() ? 'E' : ''}${bassPatterns.get().cur}`,
  tap: (i) => bassStepToggle(i),
  enter(i) {
    bassLockEnter(i);
    return bassState.get().lock === i;
  },
  restore(prev) {
    if (bassState.get().lock < 0) return;
    if (prev >= 0 && !bassEditing()) {
      bassState.set({ lock: prev, sel: prev });
      bassState.say(`LOCK ${two(prev)}`, 1200);
    } else bassLockOff();
  },
  latch: () => undefined,
  patternTap: (i) => bassPatternTap(i),
  patternHold: (i) => bassPatternHold(i),
  // Un encodeur de page, ou un potard du son (CUTOFF... de la page 4) : le pas tenu passe en LOCK avant qu'il tourne
  knobHeld(i, id) {
    const k = /^bass:knob:(.+)$/.exec(id)?.[1];
    if (!k || (!/^[1-8]$/.test(k) && !isLockable(k)) || bassEditing()) return false;
    if (bassState.get().lock !== i) bassLockEnter(i);
    return bassState.get().lock === i;
  },
  led(id) {
    if (id.startsWith('bass:page:')) return bassPage.get() === id.slice('bass:page:'.length) ? 1 : 0;
    if (id.startsWith('bass:screen:')) return bassPage.screen() === id.slice('bass:screen:'.length) ? 1 : 0;
    if (id === 'bass:lock') return !bassEditing() && bassState.get().lock >= 0 ? 1 : 0;
    if (id === 'bass:key:edit') return bassEditing() ? 1 : 0;
    // PRESET (2026-10-09, le soir) : allumee tant que les presets sont a l'ecran
    if (id === 'bass:key:preset') return presetMode.on('bass') ? 1 : 0;
    // ACCENT, SLIDE, TIE : ce qu'a le pas choisi
    if (id === 'bass:key:accent') return focusStep()?.kind === 'note' && focusStep()?.acc ? 1 : 0;
    if (id === 'bass:key:slide') return focusStep()?.kind !== 'off' && focusStep()?.slide ? 1 : 0;
    if (id === 'bass:seq:tie') return focusStep()?.kind === 'tie' ? 1 : 0;
    // MUTATE (2026-10-09) : allumee tant qu'une mutation peut s'annuler
    if (id === 'bass:mutate' || id === 'bass:key:mutate') return bassCanUndo() ? 1 : 0;
    return null;
  },
  say: (t) => bassState.say(t, 1400),
};

const map = new Map(all().map((t) => [t.id, t]));

registerTargets('bass', () => [...map.values()], (id) => map.get(id));
seqRegister('bass', seq);
