/**
 * Actions partagees (spec 7.2 et 20.6.2) : la couche de saisie, le Dock,
 * le panneau, le clavier et les jumeaux HTML passent tous par ici, pour
 * qu'un objet se comporte pareil d'ou qu'il soit actionne. Ordre d'un coup
 * de pad : le son, puis l'etat (instrument selectionne), puis l'animation.
 * Chaque action relance le contexte audio s'il dort (regle iOS).
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { clock } from './audio/clock';
import { ensure, mix, resume, setDrive, setLevel, setReverb, setStretch, setSwing, setTone, trigger } from './audio/drums';
import { BPM, VEL_NAMES, pattern, velocity } from './audio/pattern';
import { sc } from './audio/soundcloud';
import type { Stage } from './scene/renderer';
import { chipsLive, explode } from './state/explode';
import { lcdMessage } from './state/lcdMessage';
import { contactDraft, type ContactTopic } from './state/contactDraft';
import { section } from './state/section';
import { voices } from './state/voices';
import { CHIPS, POT_UI, swingRatio, type ChipId, type EncId, type Inst, type PageId, type SectionId } from './theme';

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));
const pct = (v: number): number => Math.round(v * 100);

/** Premier geste : cree le contexte audio ; ensuite, le relance s'il dort. */
export function gesture(): void {
  ensure();
  resume();
}

/**
 * Pad de voix frappe (spec 20.6.2 PAD_HIT) : tape au pointeur (au
 * relachement, regle des 6 px et 400 ms), touche A S D F ou jumeau
 * (immediats). Le son part avant tout le reste. Plus de charley ouvert au
 * pointeur : un appui immobile de plus de 400 ms n'active rien.
 */
export function padHit(inst: Inst, stage: Stage | null): void {
  gesture();
  trigger(inst);
  pattern.select(inst);
  stage?.pads.press(inst);
}

/**
 * Pad de page (spec 20.6.2 PAGE) : tape, touches 1 a 7, jumeau, onglet.
 * Ouvre sa section, ou la ferme si elle l'est deja ; le pad s'enfonce.
 */
export function page(id: PageId, stage: Stage | null): void {
  resume();
  // CONTACT ouvert directement : l'objet propose est Booking
  if (id === 'contact' && section.get() !== 'contact') contactDraft.set('booking');
  section.toggle(id);
  stage?.pads.press(id);
}

/** RESET VIEW, touche R, double tape du fond : retour a la vue par defaut (500 ms). */
export function resetView(stage: Stage | null): void {
  stage?.orbit.reset();
}

/** Choix de l'instrument sans le jouer (rangee du Dock). */
export function selectInstrument(inst: Inst): void {
  resume();
  pattern.select(inst);
}

/**
 * Pas i (0 a 15) pour l'instrument selectionne ; false sans selection
 * (spec 7.2 : il faut d'abord taper un pad). Chaque appui passe au cran
 * suivant : vide, fort, moyen, doux, vide (2026-10-01). Persiste par
 * pattern.ts ; la touche s'enfonce (stage.pressStep) ; l'ecran dira
 * STEP 07 BD HIGH / MID / LOW / OFF, ou TAP A PAD FIRST.
 */
export function stepToggle(i: number, stage: Stage | null = null): boolean {
  resume();
  stage?.pressStep(i);
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  pattern.toggle(inst, i);
  lcdMessage.show(stepLine(inst, i));
  return true;
}

/** Ligne d'ecran d'un pas : STEP 07 OH HIGH / MID / LOW / OFF. */
function stepLine(inst: Inst, i: number): string {
  return `STEP ${two(i + 1)} ${inst} ${VEL_NAMES[velocity(pattern.get().steps, inst, i)]}`;
}

/**
 * Appui long sur un pas (revision 4, 400 ms) : le pas de l'instrument
 * selectionne se vide. false sans selection.
 */
export function stepClear(i: number, stage: Stage | null = null): boolean {
  resume();
  stage?.pressStep(i);
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  pattern.clearStep(inst, i);
  lcdMessage.show(stepLine(inst, i));
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

/**
 * MUTE (2026-10-01) : coupe ou rend la voix selectionnee au sequenceur.
 * Sans selection : rend toutes les voix coupees, sinon TAP A PAD FIRST.
 */
export function muteToggle(): boolean {
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    if (voices.get().muted.length) {
      voices.clearMutes();
      lcdMessage.show('ALL VOICES ON');
      return true;
    }
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  voices.toggleMute(inst);
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'ON'}`);
  return true;
}

/**
 * SOLO (2026-10-01) : ne laisse jouer que la voix selectionnee, ou rend
 * toutes les voix. Sans selection : coupe un solo en cours, sinon TAP A
 * PAD FIRST.
 */
export function soloToggle(): boolean {
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    if (voices.get().solo) {
      voices.clearSolo();
      lcdMessage.show('SOLO OFF');
      return true;
    }
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  voices.toggleSolo(inst);
  lcdMessage.show(voices.get().solo ? `SOLO ${inst}` : 'SOLO OFF');
  return true;
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

/** Valeur affichee en ligne 3 de l'ecran : TONE +35, STRETCH 40%, SWING 58% (rapport de doubles croches). */
function readout(id: Exclude<EncId, 'tempo'>, v: number): string {
  if (id === 'swing') return `SWING ${swingRatio(v)}%`;
  if (id === 'tone') {
    const n = Math.round(v * 100);
    return `TONE ${n > 0 ? '+' : ''}${n}`;
  }
  return `${id.toUpperCase()} ${pct(v)}%`;
}

/**
 * Un encodeur (spec 20.6.2 ENC_SET) : glisser, molette, jumeau au clavier.
 * TEMPO en BPM (100 a 150, l'ecran le montre deja en ligne 1), TONE de -1
 * a 1 (accroche a 0 au centre), les autres de 0 a 1 (bornes par drums.ts et
 * le store du motif), leur valeur 1200 ms en ligne 3 de l'ecran. TONE :
 * hauteur et filtre du bus ; STRETCH : etirement granulaire ; LEVEL : gain du
 * bus, jamais le master (?mute=1 tient) ; SWING : retard des pas pairs
 * (horloge) ; DIST : saturation parallele du bus ; REVERB : envoi vers la
 * reverbe a convolution. Les trois derniers persistent avec le motif.
 */
export function dial(id: EncId, v: number): void {
  resume();
  if (id === 'tempo') {
    pattern.setBpm(v);
    return;
  }
  if (id === 'tone') setTone(v);
  else if (id === 'stretch') setStretch(v);
  else if (id === 'level') setLevel(v);
  else if (id === 'swing') setSwing(v);
  else if (id === 'dist') setDrive(v);
  else setReverb(v);
  lcdMessage.show(readout(id, dialValue(id)), POT_UI.readoutMs, true);
}

/** Valeur courante d'un encodeur : BPM, ou 0 a 1. */
export function dialValue(id: EncId): number {
  switch (id) {
    case 'tempo':
      return pattern.get().bpm;
    case 'tone':
      return mix.tone;
    case 'stretch':
      return mix.stretch;
    case 'level':
      return mix.level;
    case 'swing':
      return mix.swing;
    case 'dist':
      return mix.drive;
    default:
      return mix.reverb;
  }
}

/** Valeur de depart (double tape) : 130 BPM, TONE au centre, LEVEL 80 %, le reste a 0. */
export function dialReset(id: EncId): number {
  return id === 'tempo' ? BPM.initial : POT_UI.reset[id];
}

/** Onglet de la feuille, raccourci : ouvre une section (sans bascule). */
export function openSection(s: SectionId): void {
  section.set(s);
}

/**
 * Ouvre CONTACT avec l'objet (et le message) propose selon d'ou vient le
 * visiteur : booking, live, merch, lesson, press (2026-10-01).
 */
export function openContact(topic: ContactTopic, subject?: string, message?: string): void {
  contactDraft.set(topic, subject, message, true);
  section.set('contact');
}

/** Bouton x, Echap, glisser de la feuille. */
export function closeSection(): void {
  section.set(null);
}

/**
 * OPEN / CLOSE (spec 7.2 OPEN_TOGGLE) : la vue eclatee, depuis un etat pose
 * seulement ; la musique continue ; le pad OPEN s'enfonce. true si la
 * demande est prise.
 */
export function openToggle(stage: Stage | null = null): boolean {
  resume();
  const ok = explode.toggle();
  if (ok) stage?.pads.press('open');
  return ok;
}

/**
 * Puce de la vue eclatee (spec 20.6.2 CHIP, revision 4) : GOODIES, MERCH
 * et STUDIO ouvrent leur section ou la referment (bascule, comme un pad de
 * page)
 * (inchange) ; LABEL, un lien, ouvre sa page Bandcamp dans un onglet sans
 * opener ni referer, seulement quand son jumeau manque (sinon le jumeau,
 * un vrai lien, fait le travail).
 */
export function chipAction(id: ChipId): void {
  if (!chipsLive(explode.get())) return;
  const c = CHIPS.find((k) => k.id === id);
  if (!c) return;
  if (c.section) section.toggle(c.section);
  else if (c.href) window.open(c.href, '_blank', 'noopener,noreferrer');
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

