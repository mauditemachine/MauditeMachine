/**
 * Actions partagees (spec 7.2 et 20.6.2) : la couche de saisie, le Dock,
 * le panneau, le clavier et les jumeaux HTML passent tous par ici, pour
 * qu'un objet se comporte pareil d'ou qu'il soit actionne. Ordre d'un coup
 * de pad : le son, puis l'etat (instrument selectionne), puis l'animation.
 * Chaque action relance le contexte audio s'il dort (regle iOS).
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { clock } from './audio/clock';
import { ensure, mix, resume, setChorus, setDelay, setDrive, setLevel, setReverb, setStretch, setSwing, setTone, setVoiceFx, trigger } from './audio/drums';
import { VOICE_FX_DEFAULT, voiceFx, type VoiceParam } from './audio/voicefx';
import { randomHouse } from './audio/house';
import { BPM, VEL_NAMES, pattern, velocity } from './audio/pattern';
import { sc } from './audio/soundcloud';
import type { Stage } from './scene/renderer';
import { chipsLive, explode } from './state/explode';
import { lcdMessage } from './state/lcdMessage';
import { lcdMix } from './state/lcdMix';
import { contactDraft, type ContactTopic } from './state/contactDraft';
import { presskit } from './state/presskit';
import { section } from './state/section';
import { voices } from './state/voices';
import { CHIPS, POT_UI, VOICE_ENCODERS, encLabel, swingRatio, type ChipId, type EncId, type Inst, type PageId, type SectionId } from './theme';

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
  selectVoice(inst);
  stage?.pads.press(inst);
}

/**
 * La voix selectionnee : les pas et, depuis le 2026-10-01, les potards
 * d'effets la reglent. L'ecran le dit quand la cible change : KNOBS > BD,
 * ou KNOBS > PATTERN au retour a tout le pattern.
 */
function selectVoice(inst: Inst | null): void {
  if (pattern.get().instrument === inst) return;
  pattern.select(inst);
  lcdMessage.show(`KNOBS > ${inst ?? 'PATTERN'}`);
}

/**
 * Pad de page (spec 20.6.2 PAGE) : tape, touches 1 a 7, jumeau, onglet.
 * Ouvre sa section, ou la ferme si elle l'est deja ; le pad s'enfonce.
 */
export function page(id: PageId, stage: Stage | null): void {
  resume();
  // CONTACT ouvert directement : l'objet propose est Booking
  if (id === 'contact' && section.get() !== 'contact') contactDraft.set('booking');
  // Arrive par /presskit (2026-10-01) : PRESS rouvre la visionneuse, sur sa section
  if (id === 'press' && presskit.fromRoute()) {
    section.set('press');
    presskit.open('press');
    stage?.pads.press(id);
    return;
  }
  section.toggle(id);
  stage?.pads.press(id);
}

/** RESET VIEW, touche R, double tape du fond : retour a la vue par defaut (500 ms). */
export function resetView(stage: Stage | null): void {
  stage?.orbit.reset();
}

/** Choix de l'instrument sans le jouer (rangee du Dock) ; le meme une seconde fois : plus de selection (tout le pattern). */
export function selectInstrument(inst: Inst): void {
  resume();
  selectVoice(pattern.get().instrument === inst ? null : inst);
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
export function runToggle(stage: Stage | null = null): boolean {
  gesture();
  stage?.pressButton('run');
  if (!clock.running) sc.pauseForRun();
  return clock.toggle();
}

/**
 * MUTE (2026-10-01) : coupe ou rend la voix selectionnee au sequenceur.
 * Sans selection : rend toutes les voix coupees, sinon TAP A PAD FIRST.
 */
export function muteToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('mute');
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
export function soloToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('solo');
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
export function clearPattern(stage: Stage | null = null): void {
  resume();
  stage?.pressButton('clear');
  clock.clear();
  lcdMessage.show('CLEARED');
}

/**
 * RANDOM (2026-10-01) : un motif house tire au hasard (audio/house.ts),
 * pour toutes les voix ; la lecture continue, tempo et effets restent. Le
 * bouton s'enfonce.
 */
export function randomPattern(stage: Stage | null = null): void {
  resume();
  pattern.replace(randomHouse(pattern.get().steps));
  stage?.pressButton('random');
  lcdMessage.show('RANDOM HOUSE');
}

/** TEMPO : borne et arrondi a 100..150 ; l'horloge le prend au prochain pas. */
export function setTempo(bpm: number): void {
  resume();
  pattern.setBpm(bpm);
}

/** Valeur affichee en ligne 3 de l'ecran : TONE +35, STRETCH -40%, SWING 58%, VOLUME 80% ; BD DELAY 40% pour une voix. */
function readout(id: Exclude<EncId, 'tempo'>, v: number, inst: Inst | null): string {
  const who = inst ? `${inst} ` : '';
  const name = encLabel(id);
  if (id === 'swing') return `SWING ${swingRatio(v)}%`;
  if (id === 'tone' || id === 'stretch') {
    const n = Math.round(v * 100);
    return `${who}${name} ${n > 0 ? '+' : ''}${n}${id === 'stretch' ? '%' : ''}`;
  }
  return `${who}${name} ${pct(v)}%`;
}

/** Le parametre d'une voix que regle un potard (DIST -> dist, VOLUME -> level ; TEMPO, MASTER, SWING : aucun). */
const voiceParam = (id: EncId): VoiceParam | null => (id === 'vol' ? 'level' : VOICE_ENCODERS.includes(id) ? (id as VoiceParam) : null);

/**
 * La voix que reglent les potards (effets par piste, 2026-10-01) : celle
 * du pad selectionne, pour VOLUME, TONE, STRETCH, DIST, REVERB, DELAY et
 * CHORUS ; null : tout le pattern (VOLUME, lui, ne regle qu'une voix).
 */
export function dialTarget(id: EncId): Inst | null {
  return voiceParam(id) ? pattern.get().instrument : null;
}

/**
 * Un encodeur (spec 20.6.2 ENC_SET) : glisser, molette, jumeau au clavier.
 * TEMPO en BPM (100 a 150, l'ecran le montre deja en ligne 1), TONE et
 * STRETCH de -1 a 1 (accroches a 0 au centre), les autres de 0 a 1, leur
 * valeur 1200 ms en ligne 3 de l'ecran. Un pad selectionne : TONE,
 * STRETCH, LEVEL, DIST, REVERB, DELAY et CHORUS reglent sa voix seule
 * (audio/voicefx.ts) ; sans selection, tout le pattern : TONE hauteur et
 * filtre du bus, STRETCH duree des coups (le Time d'Impulse), LEVEL gain
 * du bus (jamais le master, ?mute=1 tient), SWING retard des pas pairs,
 * DIST saturation parallele, REVERB et DELAY envois, CHORUS insert. SWING, DIST, REVERB, DELAY et CHORUS du
 * pattern persistent avec le motif.
 */
export function dial(id: EncId, v: number): void {
  resume();
  if (id === 'tempo') {
    pattern.setBpm(v);
    return;
  }
  const inst = dialTarget(id);
  const p = voiceParam(id);
  // VOLUME n'a de sens que pour une voix
  if (id === 'vol' && !inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  if (inst && p) setVoiceFx(inst, p, v);
  else if (id === 'tone') setTone(v);
  else if (id === 'stretch') setStretch(v);
  else if (id === 'level') setLevel(v);
  else if (id === 'swing') setSwing(v);
  else if (id === 'dist') setDrive(v);
  else if (id === 'reverb') setReverb(v);
  else if (id === 'delay') setDelay(v);
  else setChorus(v);
  // VOLUME d'une voix : la page MIX montre les cinq volumes (facon Elektron)
  if (id === 'vol' && inst) {
    lcdMix.show(inst);
    return;
  }
  lcdMessage.show(readout(id, dialValue(id), inst), POT_UI.readoutMs, true);
}

/** Valeur courante d'un encodeur (celle de la voix selectionnee s'il la regle) : BPM, ou -1 a 1, ou 0 a 1. */
export function dialValue(id: EncId): number {
  const inst = dialTarget(id);
  const p = voiceParam(id);
  if (inst && p) return voiceFx.of(inst)[p];
  switch (id) {
    case 'vol':
      return VOICE_FX_DEFAULT.level;
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
    case 'reverb':
      return mix.reverb;
    case 'delay':
      return mix.delay;
    default:
      return mix.chorus;
  }
}

/** Valeur de depart (double tape) : 130 BPM, TONE et STRETCH au centre, LEVEL 80 %, le reste a 0 (pour une voix aussi). */
export function dialReset(id: EncId): number {
  const p = voiceParam(id);
  if (p && (dialTarget(id) || id === 'vol')) return VOICE_FX_DEFAULT[p];
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
    selectVoice(null);
    return true;
  }
  return false;
}

/** Ligne TRACKS ou MIXTAPES : lecture, pause ou reprise par le moteur SoundCloud. */
export function playItem(track: V2Track, queue: V2Track[]): void {
  sc.play(track, queue);
}

