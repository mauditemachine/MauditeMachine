/**
 * Actions partagees (spec 7.2 et 20.6.2) : la couche de saisie, le Dock,
 * le panneau, le clavier et les jumeaux HTML passent tous par ici, pour
 * qu'un objet se comporte pareil d'ou qu'il soit actionne. Ordre d'un coup
 * de pad : le son, puis l'etat (instrument selectionne), puis l'animation.
 * Chaque action relance le contexte audio s'il dort (regle iOS).
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { clock } from './audio/clock';
import { ensure, mix, resume, setChorus, setDelay, setDrive, setLevel, setReverb, setStretch, setSwing, setVoiceFx, trigger } from './audio/drums';
import { VOICE_FX_DEFAULT, voiceFx, type VoiceParam } from './audio/voicefx';
import { randomBeat, randomColors, type BeatStyle } from './audio/beats';
import { BPM, INSTRUMENTS, VEL_NAMES, pattern, velocity } from './audio/pattern';
import { sc } from './audio/soundcloud';
import { prepareSynth } from './audio/synth';
import type { Stage } from './scene/renderer';
import { chipsLive, explode, voyExplode, type ExplodeStore } from './state/explode';
import { focus, VOYAGER, type Focus, type MachineId } from './state/focus';
import { lcdMessage } from './state/lcdMessage';
import { lcdMix } from './state/lcdMix';
import { contactDraft, type ContactTopic } from './state/contactDraft';
import { presskit } from './state/presskit';
import { section } from './state/section';
import { voices } from './state/voices';
import { BOARD_CHIPS, MOBILE_QUERY, POT_UI, isPage, VOICE_PARAM, encLabel, isBipolar, isVoiceEnc, swingRatio, type ChipId, type EncId, type Inst, type PageId, type SectionId } from './theme';
import { arp } from './voyager/arp';
import { CHORDS, PROGRESSIONS } from './voyager/chords';
import { voyMsg } from './voyager/msg';
import { voyParams, voyReadout, type VoyKnobId } from './voyager/params';
import { randomVoyPatch } from './voyager/random';
import { seq } from './voyager/seq';

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));
const pct = (v: number): number => Math.round(v * 100);

/** Premier geste : cree le contexte audio ; ensuite, le relance s'il dort. Le moteur du MM-VOYAGER se charge avec. */
export function gesture(): void {
  ensure();
  resume();
  if (VOYAGER) prepareSynth();
}

/**
 * Pad de voix frappe (spec 20.6.2 PAD_HIT) : tape au pointeur (au
 * relachement, regle des 6 px et 400 ms), touche A S D F ou jumeau
 * (immediats). Le son part avant tout le reste. Plus de charley ouvert au
 * pointeur : un appui immobile de plus de 400 ms n'active rien.
 */
export function padHit(inst: Inst, stage: Stage | null): void {
  gesture();
  // Mode MUTE : le pad coupe sa voix (ou la rend), sans jouer
  if (voices.get().muteMode) {
    muteVoice(inst);
    stage?.pads.press(inst);
    return;
  }
  trigger(inst);
  selectVoice(inst);
  stage?.pads.press(inst);
}

/** Mode MUTE : une voix coupee ou rendue ; l'ecran le dit. */
function muteVoice(inst: Inst): void {
  voices.toggleMute(inst);
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'ON'}`);
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
    pressPage(id, stage);
    return;
  }
  section.toggle(id);
  pressPage(id, stage);
}

/** Le pad de page de la 808 s'enfonce (le MM-VOYAGER a ses pages sur la carte, pas de touche). */
function pressPage(id: PageId, stage: Stage | null): void {
  if (focus.get() === 'voy' || focus.get() === 'dj') return;
  stage?.pads.press(id);
}

/** RESET VIEW, touche R, double tape du fond : retour a la vue par defaut (500 ms). */
export function resetView(stage: Stage | null): void {
  stage?.orbit.reset();
}

/** Choix de l'instrument sans le jouer (rangee du Dock) ; le meme une seconde fois : plus de selection (tout le pattern). */
export function selectInstrument(inst: Inst): void {
  resume();
  if (voices.get().muteMode) {
    muteVoice(inst);
    return;
  }
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
 * MUTE (2026-10-03, Mika) : le mode MUTE s'allume (son temoin reste
 * allume) ; les pads de voix (et les voix du Dock, et A S D F G Z X C V B)
 * coupent ou rendent chacun sa voix, autant qu'on veut. MUTE de nouveau :
 * le mode s'eteint, toutes les voix reviennent. Renvoie l'etat du mode.
 */
export function muteToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('mute');
  const on = !voices.get().muteMode;
  voices.setMuteMode(on);
  lcdMessage.show(on ? 'MUTE: TAP VOICES' : 'ALL VOICES ON');
  return on;
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

/** Le dernier style tire par RANDOM : le suivant en change. */
let lastStyle: BeatStyle | null = null;

/**
 * RANDOM (2026-10-01 ; tous les 4x4 depuis le 2026-10-04, audio/beats.ts) :
 * un style et son motif, pour toutes les voix, plus le TONE et le VOLUME de
 * chaque voix (Mika : "le tone, le volume") ; la lecture continue, tempo,
 * GLOBAL FX et les autres VOICE FX restent ceux de l'utilisateur. Le bouton
 * s'enfonce, l'ecran dit le style.
 */
export function randomPattern(stage: Stage | null = null): void {
  resume();
  const { style, steps } = randomBeat(pattern.get().steps, lastStyle);
  lastStyle = style;
  pattern.replace(steps);
  const colors = randomColors();
  for (const inst of INSTRUMENTS) {
    voiceFx.set(inst, 'tone', colors[inst].tone);
    voiceFx.set(inst, 'level', colors[inst].level);
  }
  stage?.pressButton('random');
  lcdMessage.show(`RANDOM ${style}`);
}

/** TEMPO : borne et arrondi a 100..150 ; l'horloge le prend au prochain pas. */
export function setTempo(bpm: number): void {
  resume();
  pattern.setBpm(bpm);
}

/** Valeur affichee en ligne 3 de l'ecran : TONE +35, STRETCH -40%, SWING 58%, MASTER 80% ; BD DELAY 40% pour une voix. */
function readout(id: Exclude<EncId, 'tempo'>, v: number, inst: Inst | null): string {
  const who = inst ? `${inst} ` : '';
  const name = encLabel(id);
  if (id === 'swing') return `SWING ${swingRatio(v)}%`;
  if (isBipolar(id)) {
    const n = Math.round(v * 100);
    return `${who}${name} ${n > 0 ? '+' : ''}${n}${id === 'tone' ? '' : '%'}`;
  }
  return `${who}${name} ${pct(v)}%`;
}

/** Le parametre de voix que regle un potard de la rangee VOICE (VOLUME -> level, DIST -> dist) ; null hors de cette rangee. */
const voiceParam = (id: EncId): VoiceParam | null => (isVoiceEnc(id) ? VOICE_PARAM[id] : null);

/**
 * La voix que regle un potard : celle du pad selectionne pour la rangee
 * VOICE (VOLUME, TONE, STRETCH, DIST, CHORUS, DELAY, REVERB) ; null pour
 * TEMPO, MASTER et la rangee GLOBAL, qui reglent tout le pattern.
 */
export function dialTarget(id: EncId): Inst | null {
  return voiceParam(id) ? pattern.get().instrument : null;
}

/**
 * Un encodeur (spec 20.6.2 ENC_SET) : glisser, molette, jumeau au clavier.
 * TEMPO en BPM (100 a 150, l'ecran le montre deja en ligne 1), TONE et
 * STRETCH de -1 a 1 (accroches a 0 au centre), les autres de 0 a 1, leur
 * valeur 1200 ms en ligne 3 de l'ecran. Deux rangees depuis le 2026-10-01 :
 * VOICE regle la voix du pad selectionne (audio/voicefx.ts), et sans pad
 * demande d'en toucher un ; GLOBAL regle tout le pattern : SWING retard des
 * pas pairs, STRETCH duree des coups (le Time d'Impulse), DIST saturation
 * parallele, CHORUS insert, DELAY et REVERB envois. MASTER : le volume
 * principal (jamais le master du site, ?mute=1 tient). SWING, DIST, REVERB,
 * DELAY et CHORUS du pattern persistent avec le motif.
 */
export function dial(id: EncId, v: number): void {
  resume();
  if (id === 'tempo') {
    pattern.setBpm(v);
    return;
  }
  const p = voiceParam(id);
  if (p) {
    const inst = pattern.get().instrument;
    if (!inst) {
      lcdMessage.show('TAP A PAD FIRST');
      return;
    }
    setVoiceFx(inst, p, v);
    // VOLUME d'une voix : la page MIX montre les cinq volumes (facon Elektron)
    if (id === 'vol') lcdMix.show(inst);
    else lcdMessage.show(readout(id, dialValue(id), inst), POT_UI.readoutMs, true);
    return;
  }
  if (id === 'stretch') setStretch(v);
  else if (id === 'level') setLevel(v);
  else if (id === 'swing') setSwing(v);
  else if (id === 'dist') setDrive(v);
  else if (id === 'reverb') setReverb(v);
  else if (id === 'delay') setDelay(v);
  else setChorus(v);
  lcdMessage.show(readout(id, dialValue(id), null), POT_UI.readoutMs, true);
}

/** Valeur courante d'un encodeur (rangee VOICE : la voix selectionnee, sinon son depart) : BPM, ou -1 a 1, ou 0 a 1. */
export function dialValue(id: EncId): number {
  const p = voiceParam(id);
  if (p) {
    const inst = pattern.get().instrument;
    return inst ? voiceFx.of(inst)[p] : VOICE_FX_DEFAULT[p];
  }
  switch (id) {
    case 'tempo':
      return pattern.get().bpm;
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

/** Valeur de depart (double tape) : 130 BPM, TONE et STRETCH au centre, MASTER et VOLUME 80 %, le reste a 0. */
export function dialReset(id: EncId): number {
  const p = voiceParam(id);
  if (p) return VOICE_FX_DEFAULT[p];
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
export function openToggle(stage: Stage | null = null, which: MachineId = hoodMachine()): boolean {
  // Le MM-DECKS n'a pas de capot
  if (which === 'dj') return false;
  resume();
  const ok = hoodOf(which).toggle();
  if (ok) {
    if (which === 'voy') stage?.voy?.keys.pressButton('open');
    else stage?.pads.press('open');
  }
  return ok;
}

/** La machine dont OPEN, GOODIES, MERCH, STUDIO et CLOSE ouvrent le capot : celle qu'on utilise (vue d'ensemble : la 808). */
export function hoodMachine(): MachineId {
  return focus.machine() ?? 'mm808';
}

/** Le capot d'une machine (le MM-DECKS n'en a pas : celui de la 808). */
export function hoodOf(m: MachineId): ExplodeStore {
  return m === 'voy' ? voyExplode : explode;
}

/**
 * Puce de la vue eclatee (spec 20.6.2 CHIP, revision 4) : GOODIES, MERCH
 * et STUDIO ouvrent leur section ou la referment (bascule, comme un pad de
 * page)
 * (inchange) ; LABEL, un lien, ouvre sa page Bandcamp dans un onglet sans
 * opener ni referer, seulement quand son jumeau manque (sinon le jumeau,
 * un vrai lien, fait le travail).
 */
export function chipAction(id: ChipId, which: MachineId = 'mm808'): void {
  if (!chipsLive(hoodOf(which).get())) return;
  const c = BOARD_CHIPS.find((k) => k.id === id);
  if (!c) return;
  // Les pages sur la carte (les deux machines) : CONTACT propose Booking, PRESS rouvre la visionneuse
  if (c.section && isPage(c.section)) page(c.section, null);
  else if (c.section) section.toggle(c.section);
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
  const hood = hoodOf(hoodMachine());
  if (hood.get() === 'open') return hood.toggle();
  if (pattern.get().instrument !== null && focus.get() !== 'voy' && focus.get() !== 'dj') {
    selectVoice(null);
    return true;
  }
  // Deux machines, desktop : Echap revient a la vue d'ensemble
  if (VOYAGER && focus.get() !== 'all' && !window.matchMedia(MOBILE_QUERY).matches) {
    focus.set('all');
    return true;
  }
  return false;
}

/* ---------------- deux machines, MM-VOYAGER (2026-10-03) ---------------- */

/** Zoom sur une machine (clic sur elle, glisser au telephone), ou la vue d'ensemble. */
export function focusMachine(f: Focus): void {
  focus.set(f);
}

/**
 * Pad d'accord : l'accord entre dans la progression (ou en sort) ; le
 * premier lance l'arpege, une piste SoundCloud qui joue passe en pause
 * (une seule source a la fois, comme RUN).
 */
export function voyPad(i: number, stage: Stage | null = null): void {
  gesture();
  if (!arp.get().running) sc.pauseForRun();
  arp.toggle(i);
  stage?.voy?.keys.pressPad(i);
  const prog = arp.get().prog;
  voyMsg.show(prog.includes(i) ? `+ ${CHORDS[i].label}` : `- ${CHORDS[i].label}`);
}

/** CLEAR : plus d'accord, l'arpege s'arrete. */
export function voyClear(stage: Stage | null = null): void {
  resume();
  arp.clear();
  stage?.voy?.keys.pressButton('clear');
  voyMsg.show('CLEARED');
}

/**
 * RANDOM : une progression toute faite (jamais la meme que celle qui joue)
 * et tout le patch au hasard (2026-10-03 : arpegiateur, oscillateurs,
 * filtre, enveloppes, effets ; VOLUME garde), voyager/random.ts.
 */
export function voyRandom(stage: Stage | null = null): void {
  gesture();
  if (!arp.get().running) sc.pauseForRun();
  const cur = arp.get().prog.join(',');
  const pool = PROGRESSIONS.filter((p) => p.join(',') !== cur);
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? PROGRESSIONS[0];
  const patch = randomVoyPatch();
  for (const [id, v] of Object.entries(patch) as [VoyKnobId, number][]) voyParams.set(id, v);
  // La suite repasse en AUTO : celle que RANDOM vient de fabriquer (la suite EDIT reste en memoire)
  seq.auto();
  arp.set(pick);
  stage?.voy?.keys.pressButton('random');
  voyMsg.show('RANDOM PATCH');
}

/**
 * RUN/STOP du MM-VOYAGER (2026-10-03) : l'arpege s'arrete ou repart (sans
 * progression : F#m), sur la grille de la boite a rythmes si elle joue ;
 * sinon c'est elle qui rejoindra la sienne (clock.follow). Une piste
 * SoundCloud passe en pause, comme RUN.
 */
export function voyRun(stage: Stage | null = null): boolean {
  gesture();
  if (!arp.get().running) sc.pauseForRun();
  const on = arp.toggleRun();
  stage?.voy?.keys.pressButton('run');
  voyMsg.show(on ? 'RUN' : 'STOP');
  return on;
}

/** Un potard du MM-VOYAGER (0 a 1) ; l'ecran dit sa valeur. */
export function voyDial(id: VoyKnobId, v: number): void {
  resume();
  // MODE, RANGE et NOTES fabriquent la suite : la tourner repasse en AUTO (voyager/seq.ts)
  if (voyParams.set(id, v) && (id === 'mode' || id === 'range' || id === 'notes')) seq.auto();
  voyMsg.show(voyReadout(id, voyParams.of(id)), POT_UI.readoutMs);
}

/**
 * Les potards des deux machines passent par un seul identifiant (la
 * couche de saisie, la molette) : EncId pour la 808, v:<id> pour le
 * MM-VOYAGER.
 */
export type DialId = EncId | `v:${VoyKnobId}`;

const voyId = (id: DialId): VoyKnobId | null => (id.startsWith('v:') ? (id.slice(2) as VoyKnobId) : null);

export function anyDial(id: DialId, v: number): void {
  const k = voyId(id);
  if (k) voyDial(k, v);
  else dial(id as EncId, v);
}

export function anyDialValue(id: DialId): number {
  const k = voyId(id);
  return k ? voyParams.of(k) : dialValue(id as EncId);
}

export function anyDialReset(id: DialId): number {
  const k = voyId(id);
  return k ? voyParams.def(k) : dialReset(id as EncId);
}

/** Ligne TRACKS ou MIXTAPES : lecture, pause ou reprise par le moteur SoundCloud. */
export function playItem(track: V2Track, queue: V2Track[]): void {
  sc.play(track, queue);
}

