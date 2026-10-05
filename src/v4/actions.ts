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
import { familyOf, kit, kitSteps, type KitFamily, type KitId } from './audio/kit';
import { randomBeat, randomColors, type BeatStyle } from './audio/beats';
import { BPM, INSTRUMENTS, VEL_MAX, VEL_NAMES, pattern, velocity } from './audio/pattern';
import { sc } from './audio/soundcloud';
import { prepareSynth } from './audio/synth';
import type { Stage } from './scene/renderer';
import { chipsLive, explode, voyExplode, type ExplodeStore } from './state/explode';
import { focus, MACHINES, VOYAGER, type Focus, type MachineId } from './state/focus';
import { lcdMessage } from './state/lcdMessage';
import { lcdMix } from './state/lcdMix';
import { lcdSamples } from './state/lcdSamples';
import type { ShotId } from './audio/shotsdsp';
import { contactDraft, type ContactTopic } from './state/contactDraft';
import { editor, type EditorId } from './state/editor';
import { patterns, slotName } from './state/patterns';
import { presetMode, type PresetKey } from './state/presetMode';
import type { PresetMachine } from './state/presets';
import { presskit } from './state/presskit';
import { section } from './state/section';
import { voices } from './state/voices';
import { BOARD_CHIPS, MOBILE_QUERY, POT_UI, isPage, VOICE_PARAM, encLabel, isBipolar, isVoiceEnc, potMin, swingRatio, type ChipId, type EncId, type Inst, type PageId, type SectionId } from './theme';
import { arp } from './voyager/arp';
import { CHORDS, PROGRESSIONS } from './voyager/chords';
import { voyMsg } from './voyager/msg';
import { voyKnob, voyParams, voyReadout, voyValueText, type VoyKnobId } from './voyager/params';
import { randomVoyStyle, type VoyStyle } from './voyager/random';
import { SEQ_MAX, seq } from './voyager/seq';

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
  // Mode SOLO : le pad passe en solo (ou en sort), sans jouer
  if (voices.get().soloMode) {
    soloVoice(inst);
    stage?.pads.press(inst);
    return;
  }
  // Mode MUTE : le pad coupe sa voix (ou la rend), sans jouer
  if (voices.get().muteMode) {
    muteVoice(inst);
    stage?.pads.press(inst);
    return;
  }
  // En lecture (2026-10-05, Mika : "quand RYTM est sur RUN, cliquer sur une voix ne doit pas la jouer, juste la
  // selectionner") : la voix est choisie, sans coup ; a l'arret, elle sonne comme avant
  if (!clock.running) trigger(inst);
  selectVoice(inst);
  touchedVoice(inst);
  stage?.pads.press(inst);
}

/**
 * La voix qu'on vient de toucher (pad, Dock), hors modes : MUTE juste
 * apres la prend aussi (2026-10-04, muteToggle).
 */
let lastVoice: { inst: Inst; at: number } | null = null;
/** "Une voix, puis MUTE" : au plus 1.5 s entre les deux. */
const VOICE_THEN_MUTE_MS = 1500;

function touchedVoice(inst: Inst): void {
  lastVoice = { inst, at: performance.now() };
}

/** Mode SOLO : la voix passe en solo, ou en sort ; l'ecran le dit. */
function soloVoice(inst: Inst): void {
  voices.toggleSolo(inst);
  lcdMessage.show(voices.get().solo ? `SOLO ${inst}` : 'SOLO: TAP A VOICE');
}

/** Mode MUTE : une voix coupee ou rendue ; l'ecran le dit. */
function muteVoice(inst: Inst): void {
  voices.toggleMute(inst);
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'ON'}`);
}

/**
 * Une voix coupee ou rendue d'un coup, sans le mode MUTE (2026-10-05, le
 * Roto-Control en live : un bouton a bascule par voix, sa LED suit l'etat).
 */
export function voiceMute(inst: Inst, on: boolean): void {
  if (voices.isMuted(inst) === on) return;
  muteVoice(inst);
}

/**
 * La voix selectionnee : les pas et, depuis le 2026-10-01, les potards
 * d'effets la reglent. L'ecran le dit quand la cible change : KNOBS > BD,
 * ou KNOBS > PATTERN au retour a tout le pattern.
 */
function selectVoice(inst: Inst | null): void {
  if (pattern.get().instrument === inst) return;
  pattern.select(inst);
  // La liste des sons est ouverte : elle passe a la voix touchee (et reste un peu)
  if (lcdSamples.get()) lcdSamples.show();
  else lcdMessage.show(`KNOBS > ${inst ?? 'PATTERN'}`);
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
  if (focus.get() === 'voy' || focus.get() === 'dj' || focus.get() === 'smpl') return;
  stage?.pads.press(id);
}

/** RESET VIEW, touche R, double tape du fond : retour a la vue par defaut (500 ms). */
export function resetView(stage: Stage | null): void {
  stage?.orbit.reset();
}

/** Choix de l'instrument sans le jouer (rangee du Dock) ; le meme une seconde fois : plus de selection (tout le pattern). */
export function selectInstrument(inst: Inst): void {
  resume();
  if (voices.get().soloMode) {
    soloVoice(inst);
    return;
  }
  if (voices.get().muteMode) {
    muteVoice(inst);
    return;
  }
  selectVoice(pattern.get().instrument === inst ? null : inst);
  touchedVoice(inst);
}

/**
 * La voix a regler (KNOBS du telephone, rangee VOICES) : la choisir, hors
 * des modes MUTE et SOLO (elle ne se coupe pas en passant).
 */
export function tuneVoice(inst: Inst): void {
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
  // EDIT (2026-10-05) : les steps sont les seize patterns
  if (editor.get() === 'mm808') {
    patternTap(i, stage);
    return true;
  }
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
 * La velocite d'un pas, appui tenu puis glisse (2026-10-05, Mika : "sur les
 * steps, quand je clique et que je reste appuye, je peux changer la
 * velocite") : de 1 a 9 ; un pas vide se remplit ; l'ecran la dit. false
 * sans voix choisie.
 */
export function stepVelocity(i: number, v: number): boolean {
  if (editor.get() === 'mm808') return false;
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  const n = Math.max(1, Math.min(VEL_MAX, Math.round(v)));
  if (velocity(pattern.get().steps, inst, i) !== n) pattern.set(inst, i, n);
  lcdMessage.show(stepLine(inst, i), POT_UI.readoutMs, true);
  return true;
}

/** La velocite du pas i de la voix choisie (0 : vide, ou pas de voix). */
export function stepVelocityOf(i: number): number {
  const inst = pattern.get().instrument;
  return inst ? velocity(pattern.get().steps, inst, i) : 0;
}

/** L'appui tenu sur un pas, sans glisser encore : l'ecran dit sa velocite et comment la changer. */
export function stepHoldHint(i: number): void {
  if (editor.get() === 'mm808') {
    patternHold(i);
    return;
  }
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  lcdMessage.show(`${stepLine(inst, i)}: DRAG`, POT_UI.readoutMs * 2, true);
}

/* ---------------- les patterns du MM-RYTM (EDIT, 2026-10-05) ---------------- */

/** La chaine pour l'ecran : ses patterns, les derniers s'ils ne tiennent pas (A01>A03>A02). */
function chainLine(c: readonly number[]): string {
  const names = c.map((k) => slotName(k).slice(1));
  let out = names.join('>');
  for (let k = 1; out.length > 14 && k < names.length; k += 1) out = `..${names.slice(k).join('>')}`;
  return `CHAIN ${out}`;
}

/**
 * EDIT, un step touche : son pattern (A01 a A16). A l'arret il est pose,
 * en lecture il attend la fin de la mesure ; d'autres touches dans les deux
 * secondes en font une chaine (state/patterns.ts).
 */
export function patternTap(i: number, stage: Stage | null = null): void {
  resume();
  stage?.pressStep(i);
  const r = patterns.tap(i, clock.running);
  const p = patterns.get();
  if (r === 'chain') lcdMessage.show(chainLine(p.chain), 2600);
  else if (r === 'next') lcdMessage.show(`NEXT ${slotName(i)}: AT THE BAR`, 2000);
  else lcdMessage.show(`PATTERN ${slotName(i)}${patterns.filled(i) ? '' : ' EMPTY'}`, 2000);
}

/** EDIT, un step tenu : un emplacement vide recoit une copie du pattern courant. */
export function patternHold(i: number): void {
  const from = patterns.get().cur;
  if (patterns.copyTo(i)) lcdMessage.show(`COPY ${slotName(from)} > ${slotName(i)}`, 2000);
  else lcdMessage.show(i === from ? `${slotName(i)} PLAYS` : !patterns.filled(from) ? `${slotName(from)} IS EMPTY` : 'HOLD AN EMPTY SLOT TO COPY', 2000);
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
 *
 * 2026-10-04, Mika : "on clique sur une voix et ensuite sur MUTE, ca mute
 * la voix, mais quand on reclique sur une autre voix ca ne la mute pas".
 * Les deux ordres marchent : une voix touchee juste avant (1.5 s) se coupe
 * avec MUTE, et le mode reste allume pour les suivantes. Le mode SOLO
 * s'eteint en passant : il prenait les pads avant MUTE (MUTE allume, une
 * voix touchee passait en solo).
 */
export function muteToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('mute');
  const on = !voices.get().muteMode;
  if (on && voices.get().soloMode) voices.setSoloMode(false);
  voices.setMuteMode(on);
  const just = on && lastVoice && performance.now() - lastVoice.at <= VOICE_THEN_MUTE_MS ? lastVoice.inst : null;
  lastVoice = null;
  if (just && !voices.isMuted(just)) {
    voices.toggleMute(just);
    lcdMessage.show(`${just} MUTED: TAP VOICES`);
  } else {
    lcdMessage.show(on ? 'MUTE: TAP VOICES' : 'ALL VOICES ON');
  }
  return on;
}

/**
 * SOLO (2026-10-04, comme MUTE) : le mode s'allume, puis le pad de voix
 * touche passe en solo ; SOLO de nouveau : le mode s'eteint et toutes les
 * voix reviennent. Renvoie l'etat du mode.
 */
export function soloToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('solo');
  const on = !voices.get().soloMode;
  // Un seul mode a la fois : MUTE s'eteint (ses voix reviennent)
  if (on && voices.get().muteMode) voices.setMuteMode(false);
  lastVoice = null;
  voices.setSoloMode(on);
  lcdMessage.show(on ? 'SOLO: TAP A VOICE' : 'ALL VOICES ON');
  return on;
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
const voiceParam = (id: EncId): VoiceParam | null => (isVoiceEnc(id) && id !== 'vsound' ? VOICE_PARAM[id] : null);

/** La famille de sons de la voix selectionnee (le potard SAMPLE) ; null sans voix, ou CY et PC (un seul son). */
export function soundFamily(): KitFamily | null {
  const inst = pattern.get().instrument;
  return inst ? familyOf(inst as ShotId) : null;
}

/** SAMPLE : le son de la voix selectionnee ; l'ecran montre la liste de ses sons (state/lcdSamples.ts). */
function soundDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  const f = soundFamily();
  if (!f) {
    lcdMessage.show(`${inst} HAS ONE SOUND`);
    return;
  }
  kit.set(f, v);
  lcdSamples.show();
}

/**
 * La voix que regle un potard : celle du pad selectionne pour la rangee
 * VOICE (VOLUME, TONE, STRETCH, DIST, CHORUS, DELAY, REVERB) ; null pour
 * TEMPO, MASTER et la rangee GLOBAL, qui reglent tout le pattern.
 */
export function dialTarget(id: EncId): Inst | null {
  return isVoiceEnc(id) ? pattern.get().instrument : null;
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
  if (id === 'vsound') {
    soundDial(v);
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
  if (id === 'vsound') {
    const f = soundFamily();
    return f ? kit.value(f) : 0;
  }
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
  if (id === 'vsound') {
    const f = soundFamily();
    return f ? kit.def(f) : 0;
  }
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
  // Le MM-DECKS et le MM-SMPL n'ont pas de capot
  if (which === 'dj' || which === 'smpl') return false;
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
  // Le mode presets d'abord, puis un editeur ouvert (EDIT)
  if (presetMode.get().machine) {
    presetMode.close();
    return true;
  }
  if (editor.get() !== null) {
    editor.close();
    return true;
  }
  const hood = hoodOf(hoodMachine());
  if (hood.get() === 'open') return hood.toggle();
  if (pattern.get().instrument !== null && focus.get() !== 'voy' && focus.get() !== 'dj' && focus.get() !== 'smpl') {
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
 * Fleches gauche et droite (2026-10-05, Mika : "naviguer entre les machines
 * avec les fleches gauche droite") : la machine d'a cote, dans l'ordre de la
 * scene et du selecteur de l'en-tete (ALL, RYTM, ARP, SMPL, DECKS ; ALL
 * seulement sur desktop) ; aux bouts, rien. true si la vue a change.
 */
export function stepMachine(dir: -1 | 1): boolean {
  if (!VOYAGER) return false;
  const order: readonly Focus[] = window.matchMedia(MOBILE_QUERY).matches ? MACHINES : ['all', ...MACHINES];
  const i = order.indexOf(focus.get());
  const next = order[Math.max(0, Math.min(order.length - 1, (i < 0 ? 0 : i) + dir))];
  if (next === undefined || next === focus.get()) return false;
  focus.set(next);
  return true;
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
  stage?.voy?.keys.pressButton('clear');
  // EDIT ouvert (2026-10-05, plus de touches AUTO / EDIT dans la page) : CLEAR rend la suite des potards
  if (editor.get() === 'voy') {
    seq.auto();
    voyMsg.show('NOTES FROM THE KNOBS');
    return;
  }
  arp.clear();
  voyMsg.show('CLEARED');
}

/**
 * RANDOM : un style (2026-10-04 : BASSLINE, ACID, PLUCK, LEAD, DARK, ARP ;
 * jamais le meme deux fois de suite) et tout le patch qui lui ressemble
 * (VOLUME garde), voyager/random.ts. Les basses et l'acid ecrivent leur
 * ligne dans la suite (EDIT) et prennent une progression courte ; les
 * autres repassent en AUTO, sur une progression toute faite (jamais celle
 * qui joue). L'ecran dit le style.
 */
let lastVoyStyle: VoyStyle | null = null;

export function voyRandom(stage: Stage | null = null): void {
  gesture();
  if (!arp.get().running) sc.pauseForRun();
  const r = randomVoyStyle(lastVoyStyle);
  lastVoyStyle = r.style;
  for (const [id, v] of Object.entries(r.patch) as [VoyKnobId, number][]) voyParams.set(id, v);
  if (r.seq) {
    const buf = Array.from({ length: SEQ_MAX }, (_, i) => r.seq?.[i % (r.seq?.length || 1)] ?? null);
    seq.restore({ edit: true, buf, len: Math.min(SEQ_MAX, r.seq.length), has: true });
  } else seq.auto();
  const cur = arp.get().prog.join(',');
  const pool = PROGRESSIONS.filter((p) => p.join(',') !== cur);
  const pick = r.prog ?? pool[Math.floor(Math.random() * pool.length)] ?? PROGRESSIONS[0];
  arp.set([...pick]);
  stage?.voy?.keys.pressButton('random');
  voyMsg.show(`RANDOM ${r.style}`);
}

/** Une touche de l'ecran en mode presets (state/presetMode.ts), ou l'ecran touche au repos (open). */
export function presetKey(m: PresetMachine, k: PresetKey): void {
  gesture();
  presetMode.key(m, k);
}

/**
 * EDIT (2026-10-04, Mika : "un bouton EDIT sur la machine") : l'editeur de
 * la machine s'ouvre ou se ferme (la suite de l'arpege du MM-ARP, le motif
 * et ses velocites du MM-RYTM, state/editor.ts) ; le bouton s'enfonce,
 * l'ecran le dit.
 */
export function editToggle(which: EditorId, stage: Stage | null = null): void {
  gesture();
  editor.toggle(which);
  const on = editor.get() === which;
  if (which === 'voy') {
    stage?.voy?.keys.pressButton('edit');
    voyMsg.show(on ? 'EDIT SEQUENCE' : 'EDIT CLOSED');
  } else {
    stage?.pads.press('edit');
    const p = patterns.get();
    lcdMessage.show(on ? `PATTERNS: ${slotName(p.cur)}` : 'EDIT CLOSED');
  }
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

/**
 * PLAY/STOP du mixer du MM-DECKS (2026-10-04, Mika : "un bouton playstop
 * dans le mixer, bien place, pas trop imposant, et que ca se voie au
 * telephone") : les deux machines de ses voies 1 et 2 ensemble. L'une
 * joue : les deux s'arretent. Rien ne joue : le MM-RYTM part, l'arpege le
 * rejoint sur sa grille (sans progression, F#m). Les platines continuent :
 * c'est fait pour mixer par-dessus. Renvoie l'etat.
 */
export function machinesToggle(): boolean {
  gesture();
  if (clock.running || arp.get().running) {
    if (clock.running) clock.stop();
    if (arp.get().running) arp.stop();
    return false;
  }
  sc.pauseForRun();
  clock.toggle();
  arp.toggleRun();
  return clock.running || arp.get().running;
}

/** Un potard du MM-VOYAGER (0 a 1) ; l'ecran dit sa valeur. */
export function voyDial(id: VoyKnobId, v: number): void {
  resume();
  // MODE, RANGE et NOTES fabriquent la suite : la tourner repasse en AUTO (voyager/seq.ts)
  if (voyParams.set(id, v) && (id === 'mode' || id === 'range' || id === 'notes')) seq.auto();
  voyMsg.show(voyReadout(id, voyParams.of(id)), POT_UI.readoutMs);
}

/**
 * Un TWEAK du MM-RYTM (2026-10-04, sous le capot, audio/kit.ts) : le son
 * se recalcule en fond, l'ecran dit le reglage.
 */
export function kitDial(id: KitId, v: number): void {
  resume();
  kit.set(id, v);
  lcdMessage.show(kit.readout(id), POT_UI.readoutMs, true);
}

/**
 * Les potards des machines passent par un seul identifiant (la couche de
 * saisie, la molette) : EncId pour la 808, v:<id> pour le MM-VOYAGER,
 * r:<id> pour les TWEAKS du MM-RYTM.
 */
export type DialId = EncId | `v:${VoyKnobId}` | `r:${KitId}`;

const voyId = (id: DialId): VoyKnobId | null => (id.startsWith('v:') ? (id.slice(2) as VoyKnobId) : null);
export const kitIdOf = (id: DialId): KitId | null => (id.startsWith('r:') ? (id.slice(2) as KitId) : null);

export function anyDial(id: DialId, v: number): void {
  const r = kitIdOf(id);
  if (r) return kitDial(r, v);
  const k = voyId(id);
  if (k) voyDial(k, v);
  else dial(id as EncId, v);
}

export function anyDialValue(id: DialId): number {
  const r = kitIdOf(id);
  if (r) return kit.value(r);
  const k = voyId(id);
  return k ? voyParams.of(k) : dialValue(id as EncId);
}

export function anyDialReset(id: DialId): number {
  const r = kitIdOf(id);
  if (r) return kit.def(r);
  const k = voyId(id);
  return k ? voyParams.def(k) : dialReset(id as EncId);
}

/**
 * Les potards a l'ecran du telephone (2026-10-04, ui/KnobPanel.tsx, Mika :
 * "tous les boutons, beau et accessible, pas tout petit") : la meme saisie
 * que la machine, lue d'un seul identifiant (DialId).
 */

/** La course d'un potard : TEMPO en BPM, TONE et STRETCH de -1 a 1, les autres de 0 a 1. */
export function dialRange(id: DialId): [number, number] {
  if (kitIdOf(id) || voyId(id)) return [0, 1];
  if (id === 'tempo') return [BPM.min, BPM.max];
  return [potMin(id as EncId), 1];
}

/** Ses crans (0 : continu) : les selecteurs du MM-ARP (pas le morphing de WAVE), les choix de son du kit. */
export function dialSteps(id: DialId): number {
  if (id === 'vsound') {
    const f = soundFamily();
    return f ? kitSteps(f) : 0;
  }
  const r = kitIdOf(id);
  if (r) return kitSteps(r);
  const k = voyId(id);
  if (k) {
    const vk = voyKnob(k);
    return vk.morph ? 0 : (vk.steps?.length ?? 0);
  }
  return 0;
}

/** Sa valeur lisible (celle des ecrans des machines) ; une voix a choisir d'abord pour la rangee VOICE. */
export function dialReadout(id: DialId): string {
  const r = kitIdOf(id);
  if (r) return kit.readout(r);
  const k = voyId(id);
  if (k) return voyReadout(k, voyParams.of(k));
  if (id === 'tempo') return `${pattern.get().bpm} BPM`;
  const e = id as Exclude<EncId, 'tempo'>;
  if (isVoiceEnc(e) && !pattern.get().instrument) return 'TAP A VOICE';
  if (e === 'vsound') {
    const f = soundFamily();
    return f ? kit.readout(f) : `${pattern.get().instrument} HAS ONE SOUND`;
  }
  return readout(e, dialValue(e), dialTarget(e));
}

/** Sa valeur seule (sous un potard du telephone) : 130, 58%, +35, SAW, 909, 52 HZ. */
export function dialValueText(id: DialId): string {
  const r = kitIdOf(id);
  if (r) return kit.valueText(r);
  const k = voyId(id);
  if (k) return voyValueText(k, voyParams.of(k));
  if (id === 'tempo') return `${pattern.get().bpm}`;
  const e = id as Exclude<EncId, 'tempo'>;
  if (isVoiceEnc(e) && !pattern.get().instrument) return '--';
  if (e === 'vsound') {
    const f = soundFamily();
    return f ? kit.valueText(f) : '--';
  }
  const v = dialValue(e);
  if (e === 'swing') return `${swingRatio(v)}%`;
  if (isBipolar(e)) {
    const n = Math.round(v * 100);
    return `${n > 0 ? '+' : ''}${n}${e === 'tone' ? '' : '%'}`;
  }
  return `${pct(v)}%`;
}

/** Un seul abonnement pour toutes les valeurs des potards (les deux machines, le kit). */
export function subscribeDials(fn: () => void): () => void {
  const offs = [voyParams.subscribe(fn), mix.subscribe(fn), voiceFx.subscribe(fn), kit.subscribe(() => fn()), pattern.subscribe(fn), pattern.fx.subscribe(fn)];
  return () => {
    for (const off of offs) off();
  };
}

/** Ligne TRACKS ou MIXTAPES : lecture, pause ou reprise par le moteur SoundCloud. */
export function playItem(track: V2Track, queue: V2Track[]): void {
  sc.play(track, queue);
}

