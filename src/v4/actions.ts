/**
 * Actions partagees (spec 7.2) : la couche de saisie, le Dock, le panneau,
 * le clavier et les jumeaux HTML passent tous par ici, pour qu'un
 * objet se comporte pareil d'ou qu'il soit actionne. Ordre d'un coup de
 * pad : le son, puis l'etat (instrument selectionne), puis l'animation.
 * Chaque action relance le contexte audio s'il dort (regle iOS).
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { clock } from './audio/clock';
import { ensure, resume, setLevel, setTone, trigger } from './audio/drums';
import { pattern } from './audio/pattern';
import { sc } from './audio/soundcloud';
import type { Stage } from './scene/renderer';
import { chipsLive, explode } from './state/explode';
import { lcdMessage } from './state/lcdMessage';
import { section } from './state/section';
import { CHIPS, type ChipId, type Inst, type NavId, type SectionId } from './theme';

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Premier geste : cree le contexte audio ; ensuite, le relance s'il dort. */
export function gesture(): void {
  ensure();
  resume();
}

/** Pad frappe (pointerdown, touche) : le son part avant tout le reste. */
export function padDown(inst: Inst, stage: Stage | null): void {
  gesture();
  trigger(inst);
  pattern.select(inst);
  stage?.pads.press(inst);
}

/** CH tenu plus de 300 ms : un charley ouvert, le pad reclignote. */
export function padHold(inst: Inst, stage: Stage | null): void {
  resume();
  trigger(inst, undefined, true);
  stage?.pads.flash(inst);
}

/** Choix de l'instrument sans le jouer (rangee du Dock). */
export function selectInstrument(inst: Inst): void {
  resume();
  pattern.select(inst);
}

/**
 * Pas i (0 a 15) pour l'instrument selectionne ; false sans selection
 * (spec 7.2 : il faut d'abord taper un pad). Persiste par pattern.ts ;
 * l'ecran dira STEP 07 BD ON / OFF, ou TAP A PAD FIRST.
 */
export function stepToggle(i: number): boolean {
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  pattern.toggle(inst, i);
  const on = pattern.get().steps[inst][i] === '1';
  lcdMessage.show(`STEP ${two(i + 1)} ${inst} ${on ? 'ON' : 'OFF'}`);
  return true;
}

/**
 * RUN/STOP ; renvoie l'etat de lecture. Le contexte vient du geste en
 * cours. Une piste SoundCloud qui joue passe d'abord en pause : une seule
 * source a la fois (spec decision 5).
 */
export function runToggle(): boolean {
  gesture();
  if (!clock.running) sc.pauseForRun();
  return clock.toggle();
}

/** CLEAR : les quatre rangees a zero, la lecture continue. */
export function clearPattern(): void {
  resume();
  clock.clear();
  lcdMessage.show('CLEARED');
}

/** TEMPO : borne et arrondi a 100..150 ; l'horloge le prend au prochain pas. */
export function setTempo(bpm: number): void {
  resume();
  pattern.setBpm(bpm);
}

/** TONE : passe-bas du bus de batterie, 0 a 1 (borne par drums.ts). */
export function dialTone(v: number): void {
  resume();
  setTone(v);
}

/** LEVEL : gain du bus, 0 a 1 ; jamais le master (?mute=1 tient). */
export function dialLevel(v: number): void {
  resume();
  setLevel(v);
}

/** Knob de navigation : ouvre sa section, ou la ferme si elle l'est deja. */
export function knob(s: NavId): void {
  resume();
  section.toggle(s);
}

/** Onglet de la feuille, raccourci : ouvre une section (sans bascule). */
export function openSection(s: SectionId): void {
  section.set(s);
}

/** Bouton x, Echap, glisser de la feuille. */
export function closeSection(): void {
  section.set(null);
}

/**
 * OPEN / CLOSE (spec 7.2 OPEN_TOGGLE) : la vue eclatee, depuis un etat pose
 * seulement ; la musique continue. true si la demande est prise.
 */
export function openToggle(): boolean {
  resume();
  return explode.toggle();
}

/**
 * Puce de la vue eclatee (spec 7.2 CHIP), quand son jumeau manque (sinon
 * le jumeau, un vrai lien, fait le travail) : LABEL ouvre VRSTL Records
 * dans un onglet, LIVE la fiche technique, STUDIO sa section.
 */
export function chipAction(id: ChipId): void {
  if (!chipsLive(explode.get())) return;
  const c = CHIPS.find((k) => k.id === id);
  if (!c) return;
  if (!c.href) openSection('studio');
  else if (c.external) window.open(c.href, '_blank', 'noopener');
  else window.location.assign(c.href);
}

/**
 * Echap (spec 7.2) : ferme la section ouverte, sinon referme la vue
 * eclatee, sinon deselectionne l'instrument ; true si quelque chose a
 * change.
 */
export function escape(): boolean {
  if (section.get() !== null) {
    section.set(null);
    return true;
  }
  if (explode.get() === 'open') return explode.toggle();
  if (pattern.get().instrument !== null) {
    pattern.select(null);
    return true;
  }
  return false;
}

/** Ligne TRACKS ou MIXTAPES : lecture, pause ou reprise par le moteur SoundCloud. */
export function playItem(track: V2Track, queue: V2Track[]): void {
  sc.play(track, queue);
}
