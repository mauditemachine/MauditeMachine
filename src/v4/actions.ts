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
import { KIT_LABEL, KIT_MODELS, KIT_MODEL_LABEL, familyOf, isFamily, kit, kitSoundIndex, kitSoundNames, kitSteps, type KitFamily, type KitId } from './audio/kit';
import { lockOf, parseSnd, type LockId, type StepLock } from './audio/locks';
import { samplesOf } from './audio/samples';
import { randomBeat, randomColors, type BeatStyle } from './audio/beats';
import { BPM, INSTRUMENTS, VEL_MAX, VEL_NAMES, pattern, velocity } from './audio/pattern';
import { sc } from './audio/soundcloud';
import { prepareSynth } from './audio/synth';
import type { Stage } from './scene/renderer';
import { bassExplode, chipsLive, explode, voyExplode, type ExplodeStore } from './state/explode';
import { bassInfos } from './state/bassInfos';
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
import { rytmPage } from './state/rytmPage';
import { rytmLock } from './state/rytmLock';
import { pageLabel, pageSlots, type PageSlot, type RytmPageId, type SlotTarget } from './rytm/pages';
import { encText, encUnit, kitUnit, v127Text, velTo127 } from './rytm/values';
import { section } from './state/section';
import { voices } from './state/voices';
import { bassLoad } from './state/bassload';
import { BOARD_CHIPS, MOBILE_QUERY, PAGE_KNOB_LETTERS, POT_UI, isPage, VOICE_PARAM, encLabel, isBipolar, isVoiceEnc, potCourse, potMin, type ChipId, type EncId, type Inst, type PageId, type SectionId } from './theme';
import { arp } from './voyager/arp';
import { CHORDS, PROGRESSIONS } from './voyager/chords';
import { voyMsg } from './voyager/msg';
import { voyKnob, voyParams, voyReadout, voyValueText, type VoyKnobId } from './voyager/params';
import { randomVoyStyle, type VoyStyle } from './voyager/random';
import { SEQ_MAX, seq } from './voyager/seq';

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

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

/** Mode SOLO : la voix passe en solo, ou en sort ; a une voix, le mode retombe ; l'ecran le dit. */
function soloVoice(inst: Inst): void {
  voices.toggleSolo(inst);
  const v = voices.get();
  if (!v.soloMulti) voices.disarm('solo');
  lcdMessage.show(v.solo.includes(inst) ? `SOLO ${inst}` : `${inst} SOLO OFF`);
}

/** Mode MUTE : une voix coupee ou rendue ; a une voix, le mode retombe ; l'ecran le dit. */
function muteVoice(inst: Inst): void {
  voices.toggleMute(inst);
  if (!voices.get().muteMulti) voices.disarm('mute');
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'ON'}`);
}

/**
 * Une voix coupee ou rendue d'un coup, sans le mode MUTE (2026-10-05, le
 * Roto-Control en live : un bouton a bascule par voix, sa LED suit l'etat).
 */
export function voiceMute(inst: Inst, on: boolean): void {
  if (voices.isMuted(inst) === on) return;
  voices.toggleMute(inst);
  lcdMessage.show(`${inst} ${on ? 'MUTED' : 'ON'}`);
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
  if (focus.get() === 'voy' || focus.get() === 'dj' || focus.get() === 'bass') return;
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
  // En LOCK (2026-10-08) : une tape sur le pas en LOCK en sort, sur un autre y deplace le LOCK (le pas ne change pas)
  if (rytmLock.get().step >= 0) {
    rytmLockTap(i);
    return true;
  }
  pattern.toggle(inst, i);
  rytmPage.select(i);
  // Le geste des verrous se dit a chaque pas pose (2026-10-08, Mika : "je ne comprends toujours pas comment mettre des parameter locks")
  lcdMessage.show(`${stepLine(inst, i)}  HOLD: LOCK`);
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
  rytmPage.select(i);
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
  // La vue PAGE (2026-10-08) : TRIG en coup d'oeil, le bloc VEL montre ce pas
  rytmPage.select(i);
  touchPage('step:vel', inst);
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
  rytmPage.select(i);
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
 * MUTE (2026-10-03, Mika ; refait le 2026-10-07, state/voices.ts) :
 * - un appui arme le mode pour UNE voix : la voix touchee ensuite se coupe
 *   et le mode retombe (une autre voix touchee joue, elle ne se coupe pas) ;
 *   une voix touchee juste avant (1.5 s, 2026-10-04 : "on clique sur une
 *   voix et ensuite sur MUTE") se coupe tout de suite ;
 * - deux appuis en moins de MODE_DOUBLE_MS : MUTE multi, chaque voix
 *   touchee se coupe ou revient, autant qu'on veut ;
 * - un appui quand le mode est arme, multi, ou qu'une voix est coupee :
 *   toutes les voix reviennent.
 * Un seul mode a la fois : MUTE eteint SOLO (ses voix reviennent).
 * Renvoie l'etat du temoin.
 */
export function muteToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('mute');
  return modeTap('mute');
}

/** SOLO (2026-10-04 ; refait le 2026-10-07) : comme MUTE, sans la voix touchee juste avant. */
export function soloToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('solo');
  return modeTap('solo');
}

/** Deux appuis sur MUTE (SOLO) dans ce delai : le mode a plusieurs voix. */
export const MODE_DOUBLE_MS = 420;
/** Les messages des modes restent un peu plus que les autres ; l'ecran garde ensuite le mode et son tip (scene/screen.ts). */
const MODE_MSG_MS = 1200;
/** Le dernier appui qui a arme un mode a une voix (le premier d'un double). */
let armedTap: { kind: 'mute' | 'solo'; at: number } | null = null;

function modeTap(k: 'mute' | 'solo'): boolean {
  const now = performance.now();
  const v = voices.get();
  const word = k === 'mute' ? 'MUTE' : 'SOLO';
  // Le second appui d'un double : plusieurs voix (celle deja prise par le premier reste prise)
  if (armedTap && armedTap.kind === k && now - armedTap.at <= MODE_DOUBLE_MS) {
    armedTap = null;
    voices.arm(k, true);
    lcdMessage.show(`MULTI ${word}: ON`, MODE_MSG_MS);
    return true;
  }
  armedTap = null;
  const on = k === 'mute' ? v.muteMode : v.soloMode;
  const held = k === 'mute' ? v.muted.length > 0 : v.solo.length > 0;
  if (on || held) {
    voices.release(k);
    lastVoice = null;
    lcdMessage.show('ALL VOICES ON');
    return false;
  }
  voices.arm(k, false);
  armedTap = { kind: k, at: now };
  const just = k === 'mute' && lastVoice && now - lastVoice.at <= VOICE_THEN_MUTE_MS ? lastVoice.inst : null;
  lastVoice = null;
  if (just) {
    voices.toggleMute(just);
    voices.disarm('mute');
    lcdMessage.show(`${just} MUTED`, MODE_MSG_MS);
  } else lcdMessage.show(`${word}: 1 VOICE`, MODE_MSG_MS);
  return true;
}

/** CLEAR : les quatre rangees a zero, la lecture continue. */
export function clearPattern(stage: Stage | null = null): void {
  resume();
  stage?.pressButton('clear');
  // En LOCK (2026-10-08) : CLEAR efface les verrous du pas en LOCK, rien d'autre
  if (rytmLock.active() && editor.get() !== 'mm808') {
    rytmLockClear();
    return;
  }
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

/**
 * Valeur affichee sur la ligne du bas de l'ecran, de 0 a 127 depuis le
 * 2026-10-08 (Mika : "les valeurs de knobs sont a l'ecran ... de 0 a 127",
 * le nombre du MIDI) et son unite : BD DECAY 64  640 MS, TONE +12  +1.3 ST,
 * SWING 30  58%, MASTER 102  -2.0 DB.
 */
function readout(id: ContEnc, v: number, inst: Inst | null): string {
  const who = inst ? `${inst} ` : '';
  return `${who}${encLabel(id)} ${encText(id, v, potCourse(id, v), isBipolar(id))}  ${encUnit(id, v)}`;
}

/** Le meme pour un TWEAK du kit : KICK TUNE 64  52 HZ ; un choix de son ou GATE, son nom. */
function kitReadout(id: KitId): string {
  if (isFamily(id) || id === 'gate') return kit.readout(id);
  const label = id === 'snappy' ? 'SNARE SNAPPY' : `KICK ${KIT_LABEL[id]}`;
  return `${label} ${v127Text(kit.value(id))}  ${kitUnit(id)}`;
}

/** Le parametre de voix que regle un potard de la rangee VOICE (VOLUME -> level, DIST -> dist) ; null hors de cette rangee. */
const voiceParam = (id: EncId): VoiceParam | null => (isVoiceEnc(id) && id !== 'vsound' ? VOICE_PARAM[id] : null);
/** Un potard de la machine a valeur continue (ni TEMPO ni le choix de son). */
type ContEnc = Exclude<EncId, 'tempo' | 'vsound'>;

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
  touchPage('vsound', inst);
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
 * La vue PAGE de l'ecran du MM-RYTM (2026-10-08, la refonte facon
 * Digitakt, Mika : "8 encodeurs assignables a condition de presser les
 * bonnes touches ; l'ecran divise en 8 blocs") : un reglage touche cerne
 * son bloc quand il est sur la page affichee (state/rytmPage.ts).
 */
function touchPage(t: SlotTarget, inst: Inst | null): void {
  rytmPage.touch(t, inst);
}

/** L'ecran du MM-RYTM montre-t-il celui d'aujourd'hui (HOME, ou EDIT et son anneau des patterns) ? */
function screenHome(): boolean {
  return editor.get() === 'mm808' || rytmPage.get().view === 'home';
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
    // VOLUME d'une voix : la page MIX montre les cinq volumes (facon Elektron), sur l'ecran d'aujourd'hui
    // seulement (HOME, EDIT) ; en vue PAGE (2026-10-08) le bloc VOL de AMP montre la valeur, la ligne du bas la dit
    if (id === 'vol' && screenHome()) lcdMix.show(inst);
    else {
      lcdMessage.show(readout(id as ContEnc, dialValue(id), inst), POT_UI.readoutMs, true);
      touchPage(id, inst);
    }
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
  touchPage(id, pattern.get().instrument);
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
  // Le MM-DECKS n'a pas de capot ; le MM-BASS a le sien depuis le 2026-10-08 (sa touche OPEN est sur sa face)
  if (which === 'dj') return false;
  resume();
  const ok = hoodOf(which).toggle();
  if (ok) {
    if (which === 'voy') stage?.voy?.keys.pressButton('open');
    else if (which === 'mm808') stage?.pads.press('open');
  }
  return ok;
}

/** La machine dont OPEN, GOODIES, MERCH, STUDIO et CLOSE ouvrent le capot : celle qu'on utilise (vue d'ensemble : la 808). */
export function hoodMachine(): MachineId {
  return focus.machine() ?? 'mm808';
}

/** Le capot d'une machine (le MM-DECKS n'en a pas : celui de la 808). */
export function hoodOf(m: MachineId): ExplodeStore {
  return m === 'voy' ? voyExplode : m === 'bass' ? bassExplode : explode;
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
  // Le LOCK du MM-RYTM (2026-10-08) : Echap en sort, avant de fermer EDIT
  if (rytmLock.leave()) {
    lcdMessage.show('LOCK OFF');
    return true;
  }
  if (editor.get() !== null) {
    editor.close();
    return true;
  }
  // INFOS du MM-BASS (2026-10-08) : Echap l'eteint avant de refermer le capot
  // INFOS du MM-BASS : seulement quand on le voit (ailleurs, Echap ferme le capot de la machine a l'ecran)
  if (bassInfos.isOn() && focus.get() === 'bass') {
    bassInfos.set(false);
    return true;
  }
  const hood = hoodOf(hoodMachine());
  if (hood.get() === 'open') return hood.toggle();
  if (pattern.get().instrument !== null && focus.get() !== 'voy' && focus.get() !== 'dj' && focus.get() !== 'bass') {
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
 * scene et du selecteur de l'en-tete (ALL, RYTM, BASS, ARP, DECKS ; ALL
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

/** Une machine du site joue-t-elle (le MM-RYTM, le MM-BASS, le MM-ARP) ? */
export function machinesRunning(): boolean {
  return clock.running || arp.get().running || !!bassLoad.get()?.bassSeq.running;
}

/**
 * PLAY/STOP du mixer du MM-DECKS (2026-10-04, Mika : "un bouton playstop
 * dans le mixer, bien place, pas trop imposant, et que ca se voie au
 * telephone") : les machines de ses voies ensemble, le MM-BASS avec elles
 * depuis le 2026-10-07 (ses voies 1 a 3). L'une joue : toutes s'arretent.
 * Rien ne joue : le MM-RYTM part, l'arpege et la basse le rejoignent sur sa
 * grille. Les platines continuent : c'est fait pour mixer par-dessus (et
 * elles suivent le tempo des machines, dj/actions.ts). Renvoie l'etat.
 */
/** Le numero du dernier PLAY/STOP des machines : un depart de la basse qui attend le son ne survit pas a un STOP. */
let machinesGen = 0;

export function machinesToggle(): boolean {
  gesture();
  const gen = ++machinesGen;
  if (machinesRunning()) {
    if (clock.running) clock.stop();
    // Un RUN qui attend encore le son : STOP l'annule (toggle, clock.ts)
    else if (clock.waiting) clock.toggle();
    if (arp.get().running) arp.stop();
    bassLoad.get()?.bassSeq.stop();
    return false;
  }
  sc.pauseForRun();
  clock.toggle();
  arp.toggleRun();
  void bassLoad.load()?.then((m) => m.bassEngine.ensure().then(() => {
    // Toujours voulu : rien ne l'a arretee entre-temps
    if (clock.running) {
      if (!m.bassSeq.running) m.bassSeq.start();
      return;
    }
    // Le son se reveille encore (2026-10-08 : l'horloge attend que le contexte joue) : la basse part avec elle
    if (!clock.waiting) return;
    const t0 = performance.now();
    const off = clock.subscribe(() => {
      if (gen !== machinesGen) off();
      else if (clock.running) {
        off();
        if (!m.bassSeq.running) m.bassSeq.start();
      } else if (performance.now() - t0 > 20000) off();
    });
  }));
  return true;
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
  lcdMessage.show(kitReadout(id), POT_UI.readoutMs, true);
  // Son bloc cerne quand la page affichee le porte (rytm/pages.ts slotOf : SRC, SOUND ou SAMPLE)
  touchPage(`r:${id}`, pattern.get().instrument);
}

/**
 * Les potards des machines passent par un seul identifiant (la couche de
 * saisie, la molette) : EncId pour la 808, v:<id> pour le MM-VOYAGER,
 * r:<id> pour les TWEAKS du MM-RYTM, p:<0-7> pour les huit potards de page
 * du MM-RYTM (2026-10-08, la refonte facon Digitakt : le potard k regle le
 * bloc k de la page affichee, pour la voix choisie, rytm/pages.ts).
 */
export type DialId = EncId | `v:${VoyKnobId}` | `r:${KitId}` | `p:${number}`;

const voyId = (id: DialId): VoyKnobId | null => (id.startsWith('v:') ? (id.slice(2) as VoyKnobId) : null);
export const kitIdOf = (id: DialId): KitId | null => (id.startsWith('r:') ? (id.slice(2) as KitId) : null);

/* ---------------- les potards de page du MM-RYTM (2026-10-08) ---------------- */

/** Le rang (0 a 7) d'un potard de page, -1 pour un autre potard. */
export const pageKnobOf = (id: DialId): number => (id.startsWith('p:') ? Number(id.slice(2)) : -1);

/** Ce que porte le potard de page k sur la page affichee, pour la voix choisie. */
export function pageSlotOf(k: number): PageSlot | null {
  return pageSlots(rytmPage.get().page, pattern.get().instrument)[k] ?? null;
}

/** La cible du potard de page k (un DialId ou la velocite du pas), null : vide ou a venir. */
export function pageTarget(k: number): SlotTarget | null {
  return pageSlotOf(k)?.target ?? null;
}

/**
 * TRIG VEL (2026-10-08) : la velocite du pas choisi, de 0 a 9 ; 0 le vide
 * (OFF, ce que le bloc montre au bas de sa course), 1 a 9 le pose ou le
 * change (stepVelocity). false sans voix choisie, ou dans EDIT (les pas y
 * sont les patterns).
 */
function stepLevel(i: number, v: number): boolean {
  const n = Math.max(0, Math.min(VEL_MAX, Math.round(v)));
  if (n > 0) return stepVelocity(i, n);
  if (editor.get() === 'mm808') return false;
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  if (velocity(pattern.get().steps, inst, i) !== 0) pattern.clearStep(inst, i);
  rytmPage.select(i);
  touchPage('step:vel', inst);
  lcdMessage.show(stepLine(inst, i), POT_UI.readoutMs, true);
  return true;
}

/** Les echantillons de la famille de la voix choisie (SMPL SAMPLE), 0 sans voix ni famille. */
function sampleCount(): number {
  const f = soundFamily();
  return f ? Math.max(0, kitSteps(f) - KIT_MODELS.length) : 0;
}

/** SMPL SAMPLE : 0 (OFF, le son de synthese de la famille joue) ou le rang de l'echantillon, 1 a n. */
function sampleValue(): number {
  const f = soundFamily();
  if (!f) return 0;
  const i = kitSoundIndex(f);
  return i < KIT_MODELS.length ? 0 : i - KIT_MODELS.length + 1;
}

/**
 * SMPL SAMPLE tourne (2026-10-08, revue de R1 : le bloc SAMPLE montrait 909,
 * un son de synthese) : OFF rend a la famille son son de synthese (celui que
 * le kit garde sous l'echantillon, kit.model), un cran plus loin l'un de ses
 * echantillons ; la liste des sons s'ouvre comme pour SOUND. Le meme choix
 * de son du kit que SOUND de SRC, sans ses trois synthes, jusqu'aux deux
 * couches SYNTH et SAMPLE de l'etape R3.
 */
function sampleDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  const f = soundFamily();
  const n = sampleCount();
  if (!f || n === 0) {
    lcdMessage.show(`${inst}: NO SAMPLES`);
    return;
  }
  const j = Math.max(0, Math.min(n, Math.round(v)));
  kit.setSound(f, j === 0 ? kit.get().model[f] : samplesOf(f)[j - 1].key);
  lcdSamples.show();
  touchPage('smpl:sample', inst);
}

/** SMPL SAMPLE ecrit : OFF, ou le nom de l'echantillon (BLUEPRINT) ; '--' sans echantillon a choisir. */
function sampleText(): string {
  const f = soundFamily();
  if (!f || sampleCount() === 0) return '--';
  return sampleValue() === 0 ? 'OFF' : kit.valueText(f);
}

/** Sa ligne d'unite : SYNTH 909 (OFF : le son de synthese joue), 2 OF 6. */
function sampleUnit(): string {
  const f = soundFamily();
  const n = sampleCount();
  if (!f) return '';
  if (n === 0) return 'NO SAMPLES';
  const j = sampleValue();
  // Le rang seul (2026-10-08) : le bloc s'appelle deja SAMPLE, et ses crans tiennent au bout de la ligne
  return j === 0 ? `SYNTH ${KIT_MODEL_LABEL[kit.get().model[f]]}` : `${j} OF ${n}`;
}

/**
 * Un potard de page tourne : il regle ce que son bloc montre ; un bloc vide
 * le dit a l'ecran (jamais un geste qui ne fait rien en silence). TRIG VEL :
 * la velocite du pas choisi ; SMPL SAMPLE : l'echantillon de la voix.
 * L'echo (le contour du bloc) une seule fois : le reglage touche l'a deja
 * pose s'il est sur la page (touchPage), sinon il est pose ici.
 */
function pageDial(k: number, v: number): void {
  resume();
  const slot = pageSlotOf(k);
  const page = pageLabel(rytmPage.get().page);
  const letter = PAGE_KNOB_LETTERS[k] ?? '?';
  const t = slot && slot.label ? slot.target : null;
  if (!slot || t === null) {
    lcdMessage.show(`${letter}: EMPTY ON ${page}`);
    return;
  }
  // Un pas tenu (deux doigts, ou la souris et un potard MIDI, 2026-10-08) : le LOCK passe sur lui des ce potard,
  // meme avant les 350 ms de la tenue
  const lk = rytmLock.get();
  if (editor.get() !== 'mm808' && lk.held.length > 0 && !lk.held.includes(lk.step) && pattern.get().instrument) rytmLockEnter(lk.held[0], false);
  // En LOCK (2026-10-08) : le potard pose le verrou du pas (des pas tenus), jamais la valeur de la voix
  if (lockMode()) {
    lockWrite(k, slot, v);
    return;
  }
  const before = rytmPage.get().echo;
  if (t === 'step:vel') {
    const sel = rytmPage.get().sel;
    if (sel < 0) {
      lcdMessage.show(pattern.get().instrument ? 'VEL: HOLD A STEP' : 'TAP A PAD FIRST');
      return;
    }
    if (!stepLevel(sel, v)) return;
  } else if (t === 'smpl:sample') sampleDial(v);
  else anyDial(t, v);
  // Rien a regler (pas de voix choisie, une voix a un seul son) : le message suffit, pas de contour
  if (!pageKnobLive(k)) return;
  const e = rytmPage.get().echo;
  if (!e || e === before || e.k !== k || e.page !== rytmPage.get().page) rytmPage.echo(k);
}

/**
 * Le potard de page k a-t-il quelque chose a regler maintenant (un bloc
 * vivant) ? Non pour un bloc vide, un reglage de voix sans voix choisie,
 * VEL sans pas choisi, SOUND ou SAMPLE d'une voix sans choix de son.
 */
export function pageKnobLive(k: number): boolean {
  return dialValueText(`p:${k}` as DialId) !== '--';
}

/**
 * La course (0 a 1) du potard de page k : celle de ce que son bloc regle,
 * que lisent son repere sur la face, son jumeau et le MIDI (rytm:knob) ; un
 * bloc qui n'a rien a regler (pageKnobLive) : en bas, comme son bloc vide
 * (2026-10-08, revue de R1 : a midi, le repere faisait croire a une valeur).
 */
export function pageKnobCourse(k: number): number {
  if (!pageKnobLive(k)) return 0;
  const id = `p:${k}` as DialId;
  const [lo, hi] = dialRange(id);
  return hi > lo ? Math.max(0, Math.min(1, (anyDialValue(id) - lo) / (hi - lo))) : 0;
}

/** La cible d'un potard (un potard de page : celle de son bloc ; null, vide ou a venir). */
const resolve = (id: DialId): SlotTarget | null => {
  const k = pageKnobOf(id);
  return k < 0 ? id : pageTarget(k);
};

export function anyDial(id: DialId, v: number): void {
  const pk = pageKnobOf(id);
  if (pk >= 0) return pageDial(pk, v);
  const r = kitIdOf(id);
  if (r) return kitDial(r, v);
  const k = voyId(id);
  if (k) voyDial(k, v);
  else dial(id as EncId, v);
}

export function anyDialValue(id: DialId): number {
  const pk = pageKnobOf(id);
  if (pk >= 0 && lockMode()) {
    const lv = lockDialValue(pk);
    if (lv !== null) return lv;
  }
  const t = resolve(id);
  if (t === null) return 0;
  if (t === 'step:vel') {
    const sel = rytmPage.get().sel;
    return sel < 0 ? 0 : stepVelocityOf(sel);
  }
  if (t === 'smpl:sample') return sampleValue();
  const r = kitIdOf(t);
  if (r) return kit.value(r);
  const k = voyId(t);
  return k ? voyParams.of(k) : dialValue(t as EncId);
}

export function anyDialReset(id: DialId): number {
  const t = resolve(id);
  if (t === null) return 0;
  // Un pas remis a sa velocite d'un appui (fort) ; un pas vide le reste (deux tapes n'y posent pas de note)
  if (t === 'step:vel') {
    const sel = rytmPage.get().sel;
    return sel >= 0 && stepVelocityOf(sel) > 0 ? VEL_MAX : 0;
  }
  // SMPL SAMPLE : OFF, le son de synthese
  if (t === 'smpl:sample') return 0;
  const r = kitIdOf(t);
  if (r) return kit.def(r);
  const k = voyId(t);
  return k ? voyParams.def(k) : dialReset(t as EncId);
}

/**
 * Les potards a l'ecran du telephone (2026-10-04, ui/KnobPanel.tsx, Mika :
 * "tous les boutons, beau et accessible, pas tout petit") : la meme saisie
 * que la machine, lue d'un seul identifiant (DialId).
 */

/** La course d'un potard : TEMPO en BPM, TONE et STRETCH de -1 a 1, les autres de 0 a 1 ; VEL de 0 a 9. */
export function dialRange(id: DialId): [number, number] {
  const t = resolve(id);
  if (t === null) return [0, 1];
  if (t === 'vsound' && pageKnobOf(id) >= 0 && lockMode()) return [0, Math.max(1, lockSoundsOf().length - 1)];
  if (t === 'step:vel') return [0, VEL_MAX];
  if (t === 'smpl:sample') return [0, Math.max(1, sampleCount())];
  if (kitIdOf(t) || voyId(t)) return [0, 1];
  if (t === 'tempo') return [BPM.min, BPM.max];
  return [potMin(t as EncId), 1];
}

/** Ses crans (0 : continu) : les selecteurs du MM-ARP (pas le morphing de WAVE), les choix de son du kit. */
export function dialSteps(id: DialId): number {
  const t = resolve(id);
  if (t === null) return 0;
  if (t === 'step:vel') return VEL_MAX + 1;
  // SOUND en LOCK (2026-10-08) : les sons de toutes les familles, un cran chacun
  if (t === 'vsound' && pageKnobOf(id) >= 0 && lockMode()) return lockSoundsOf().length;
  // TUNE : au demi-ton, 49 crans (-24 a +24)
  if (t === 'vtune') return 49;
  if (t === 'smpl:sample') {
    const n = sampleCount();
    return n > 0 ? n + 1 : 0;
  }
  if (t === 'vsound') {
    const f = soundFamily();
    return f ? kitSteps(f) : 0;
  }
  const r = kitIdOf(t);
  if (r) return kitSteps(r);
  const k = voyId(t);
  if (k) {
    const vk = voyKnob(k);
    return vk.morph ? 0 : (vk.steps?.length ?? 0);
  }
  return 0;
}

/**
 * Un cran de molette ou de fleche (2026-10-08, Mika : "de 0 a 127") : un
 * cent-vingt-septieme de la course (un cran pour un reglage a crans), n crans
 * dans le sens de n. Un cran que le reglage ne prend pas (un TWEAK du kit au
 * cinquantieme, le centre accrocheur de TONE et STRETCH) est repris un cran
 * plus loin, jusqu'a ce que la valeur bouge : jamais un geste sans effet.
 */
export function dialNudge(id: DialId, n: number): void {
  if (n === 0) return;
  const [lo, hi] = dialRange(id);
  const steps = dialSteps(id);
  const notch = steps > 1 ? (hi - lo) / (steps - 1) : (hi - lo) / 127;
  const v0 = anyDialValue(id);
  for (let m = 1; m <= 8; m += 1) {
    const v = Math.min(hi, Math.max(lo, v0 + n * notch * m));
    anyDial(id, Math.round(v * 10000) / 10000);
    if (anyDialValue(id) !== v0 || v === lo || v === hi) return;
  }
}

/** Sa valeur lisible (celle des ecrans des machines) ; une voix a choisir d'abord pour la rangee VOICE. */
export function dialReadout(id: DialId): string {
  const pk = pageKnobOf(id);
  if (pk >= 0) {
    const slot = pageSlotOf(pk);
    if (!slot || !slot.label) return 'nothing on this page';
    const t = slot.target;
    if (t === null) return `${slot.label}, coming soon`;
    // En LOCK (2026-10-08) : ce que le pas a, verrouille ou non
    const ls = lockReadStep();
    if (lockMode() && ls >= 0) {
      const lv = pageLockView(pk, ls);
      if (slot.scope === 'all') return `${slot.label}, global, not lockable`;
      if (!slot.lock) return `${slot.label}, not lockable yet`;
      if (lv) return `${slot.label} ${lv.text}${lv.unit ? `, ${lv.unit.toLowerCase()}` : ''}, locked on step ${two(ls + 1)}`;
      return `${slot.label} ${dialValueText(id)}, not locked on step ${two(ls + 1)}`;
    }
    if (t === 'step:vel') {
      const sel = rytmPage.get().sel;
      const v = sel < 0 ? 0 : stepVelocityOf(sel);
      return sel < 0 ? 'VEL, hold a step first' : `VEL ${v > 0 ? velTo127(v) : 'OFF'}, step ${two(sel + 1)}`;
    }
    if (t === 'smpl:sample') {
      const txt = sampleText();
      return txt === '--' ? (pattern.get().instrument ? 'SAMPLE, no samples for this voice' : 'TAP A VOICE') : `SAMPLE ${txt}, ${sampleUnit().toLowerCase()}`;
    }
    return dialReadout(t);
  }
  const r = kitIdOf(id);
  if (r) return kitReadout(r);
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

/**
 * Sa valeur seule (sous un potard du telephone, dans un bloc de l'ecran) :
 * TEMPO en BPM, les potards du MM-RYTM de 0 a 127 (-64 a +63 a zero au
 * centre) depuis le 2026-10-08, un choix de son par son nom (909, BLUEPRINT),
 * GATE OFF ou ON ; le MM-ARP garde les siens (SAW, 52 HZ).
 */
export function dialValueText(id: DialId): string {
  const pk = pageKnobOf(id);
  if (pk >= 0) {
    const t = pageTarget(pk);
    if (t === null) return '--';
    // En LOCK (2026-10-08) : la valeur verrouillee du pas, sinon celle de la voix
    const ls = lockReadStep();
    if (ls >= 0 && pattern.get().instrument) {
      const lv = pageLockView(pk, ls);
      if (lv) return lv.text;
    }
    if (t === 'step:vel') {
      const sel = rytmPage.get().sel;
      if (sel < 0) return '--';
      const v = stepVelocityOf(sel);
      // Le pas vide : OFF, comme le bloc de l'ecran
      return v > 0 ? String(velTo127(v)) : 'OFF';
    }
    if (t === 'smpl:sample') return sampleText();
    return dialValueText(t);
  }
  const r = kitIdOf(id);
  if (r) return isFamily(r) || r === 'gate' ? kit.valueText(r) : v127Text(kit.value(r));
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
  return encText(e, v, potCourse(e, v), isBipolar(e));
}

/** La ligne d'unite d'un potard du MM-RYTM (216 MS, -3.2 DB, rytm/values.ts) ; '' sans unite. */
export function dialUnit(id: DialId): string {
  const t = resolve(id);
  if (t === null) return '';
  const pk = pageKnobOf(id);
  const ls = lockReadStep();
  if (pk >= 0 && ls >= 0 && pattern.get().instrument) {
    const lv = pageLockView(pk, ls);
    if (lv) return lv.unit;
  }
  if (t === 'step:vel') {
    const sel = rytmPage.get().sel;
    return sel < 0 ? 'HOLD A STEP' : `STEP ${two(sel + 1)}`;
  }
  if (t === 'smpl:sample') return sampleUnit();
  const r = kitIdOf(t);
  if (r) return isFamily(r) ? '' : r === 'gate' ? 'SD + CP' : kitUnit(r);
  if (t === 'vsound') {
    // Le choix du son : d'ou il vient (SYNTH 909 / 808 / MM, ou un echantillon) et son rang, comme le bloc de l'ecran
    const f = soundFamily();
    const n = f ? kitSteps(f) : 0;
    const i = f ? kitSoundIndex(f) : 0;
    return n > 0 ? `${i < 3 ? 'SYNTH' : 'SAMPLE'} ${i + 1}/${n}` : '';
  }
  if (voyId(t) || t === 'tempo') return '';
  const e = t as ContEnc;
  if (isVoiceEnc(e) && !pattern.get().instrument) return '';
  return encUnit(e, dialValue(e));
}

/**
 * EDIT ou le mode presets du MM-RYTM tiennent-ils l'ecran ? Une touche de
 * page les referme (2026-10-08, revue de R1 : pressee sous EDIT, elle
 * changeait la vue cachee sans rien montrer, et EDIT referme laissait HOME) ;
 * rend true s'il y en avait un.
 */
function leaveRytmOverlay(): boolean {
  let left = false;
  if (editor.get() === 'mm808') {
    editor.close();
    left = true;
  }
  if (presetMode.on('mm808')) {
    presetMode.close();
    left = true;
  }
  return left;
}

/**
 * Une touche de page du MM-RYTM (la face, le Dock, le MIDI, 2026-10-08) :
 * sa page s'affiche ; la touche deja allumee pressee encore : HOME (l'ecran
 * d'avant, l'anneau), puis PAGE. Sous EDIT ou les presets, elle les referme
 * et montre sa page (jamais HOME : on ne voyait pas la page qu'on quittait).
 * La touche s'enfonce.
 */
export function rytmPageKey(id: RytmPageId, stage: Stage | null = null): void {
  resume();
  stage?.pressPageKey(id);
  if (leaveRytmOverlay()) {
    rytmPage.setPage(id);
    lcdMessage.show(`${pageLabel(id)} PAGE`);
    return;
  }
  // En LOCK (2026-10-08) : une touche de page choisit la page des verrous, jamais HOME (l'ecran reste aux blocs)
  const lk = rytmLock.get().step;
  if (lk >= 0 && editor.get() !== 'mm808') {
    rytmPage.setPage(id);
    lcdMessage.show(`${pageLabel(id)} PAGE  LOCK ${two(lk + 1)}`);
    return;
  }
  const was = rytmPage.get().view;
  const view = rytmPage.press(id);
  // HOME le dit (et comment revenir) ; le retour de HOME aussi (le message de HOME ne reste pas)
  if (view === 'home') lcdMessage.show(`HOME  ${pageLabel(id)} AGAIN: PAGE`, 1600);
  else if (was === 'home') lcdMessage.show(`${pageLabel(id)} PAGE`);
}

/** rytm:page en MIDI (un potard a six crans) : la page, en vue PAGE ; sous EDIT ou les presets, comme une touche. */
export function rytmShowPage(id: RytmPageId): void {
  const left = leaveRytmOverlay();
  const same = id === rytmPage.get().page && rytmPage.get().view === 'page';
  rytmPage.setPage(id);
  if (left || !same) lcdMessage.show(`${pageLabel(id)} PAGE`);
}

/** rytm:home en MIDI (H au clavier, hors EDIT) : HOME, ou la vue PAGE ; sous EDIT ou les presets, les referme sur HOME. */
export function rytmHome(): void {
  if (leaveRytmOverlay()) rytmPage.setView('home');
  else rytmPage.toggleView();
}

/* ---------------- les verrous du MM-RYTM (2026-10-08, l'etape R2 des P-locks) ---------------- */

/*
 * Mika (2026-10-08) : "quand on clic sur un step on selectionne la partie
 * qu'on veut modifier, est-ce que le voice, est-ce que le FX, est-ce que
 * l'enveloppe, et ensuite on tourne un encoder sur ce step et donc ce step a
 * une valeur differente, et on voit a l'ecran que quand le sequenceur passe
 * sur ce step alors le changement est fait ... MEME CHOSE DANS RYTM". Un pas
 * tenu (ou mis en LOCK, state/rytmLock.ts), une touche de page, un potard
 * de page : le bloc du potard pose son verrou sur ce pas (audio/locks.ts),
 * l'ecran le montre en negatif. Hors de EDIT seulement (ses pas y sont les
 * patterns).
 */

/** Les potards de page reglent-ils des verrous (un pas en LOCK ou tenu, hors EDIT) ? */
export function lockMode(): boolean {
  return rytmLock.active() && editor.get() !== 'mm808';
}

/** Le pas dont les potards lisent les verrous : le pas en LOCK ; -1 hors LOCK. */
export function lockReadStep(): number {
  return lockMode() ? rytmLock.get().step : -1;
}

/** Un son de la liste de SOUND en LOCK : le verrou ('<famille>:<son>' ; '' : le son de la voix) et son nom. */
export interface LockSound {
  snd: string;
  label: string;
}

/** Les familles dans l'ordre de la liste (celle de la voix d'abord), et leur nom court. */
const LOCK_FAMS: readonly KitFamily[] = ['bd', 'sd', 'cp', 'hh', 'tom'];
const FAM_TAG: Readonly<Record<KitFamily, string>> = { bd: 'BD', sd: 'SD', cp: 'CP', hh: 'HH', tom: 'TOM', rs: 'RS' };
const lockSoundCache = new Map<string, readonly LockSound[]>();

/**
 * SOUND en LOCK (le "sample lock" d'une Digitakt) : les sons de la famille
 * de la voix d'abord (909, 808, MM, ses echantillons), puis ceux des autres
 * familles, leur famille devant (CP 909, SD PSY 02) ; une voix sans famille
 * (CY) commence par son propre son (pas de verrou).
 */
export function lockSounds(inst: Inst): readonly LockSound[] {
  let out = lockSoundCache.get(inst);
  if (out) return out;
  const own = familyOf(inst as ShotId);
  const list: LockSound[] = own ? [] : [{ snd: '', label: inst }];
  for (const f of own ? [own, ...LOCK_FAMS.filter((x) => x !== own)] : LOCK_FAMS) {
    const names = kitSoundNames(f);
    const sounds = [...KIT_MODELS, ...samplesOf(f).map((x) => x.key)];
    sounds.forEach((snd, i) => list.push({ snd: `${f}:${snd}`, label: f === own ? names[i] : `${FAM_TAG[f]} ${names[i]}` }));
  }
  out = list;
  lockSoundCache.set(inst, out);
  return out;
}
const lockSoundsOf = (): readonly LockSound[] => {
  const inst = pattern.get().instrument;
  return inst ? lockSounds(inst) : [];
};

/** Le nom d'un son verrouille, tel que la liste l'ecrit (BLUEPRINT, CP 909). */
function sndLabel(inst: Inst, snd: string): string {
  const hit = lockSounds(inst).find((x) => x.snd === snd);
  if (hit) return hit.label;
  const p = parseSnd(snd);
  return p ? kit.soundName(p.family as KitFamily, p.sound) : snd.toUpperCase();
}

/** SMPL SAMPLE en LOCK : OFF (le son de synthese de la famille) puis ses echantillons, en verrous. */
function lockSamples(f: KitFamily): string[] {
  return [`${f}:${kit.get().model[f]}`, ...samplesOf(f).map((x) => `${f}:${x.key}`)];
}

/** Le nom d'un verrou pour l'ecran (DEC, SOUND) : le nom du bloc. */
const lockName = (slot: PageSlot): string => slot.label;

/**
 * Ce que montre le bloc k pour les verrous du pas `step` de la voix choisie
 * (en LOCK, ou le pas qui joue) : sa valeur ecrite, son unite, sa course et
 * sa valeur ; null quand le pas n'a pas de verrou pour ce bloc. VEL : la
 * velocite du pas lui-meme (c'est son verrou), null sur un pas vide.
 */
export function pageLockView(k: number, step: number, lockArg?: Readonly<StepLock> | null): { text: string; unit: string; course: number; value: number } | null {
  const slot = pageSlotOf(k);
  const inst = pattern.get().instrument;
  if (!slot || !slot.lock || !inst || step < 0) return null;
  if (slot.lock === 'vel') {
    const v = velocity(pattern.get().steps, inst, step);
    if (v === 0) return null;
    return { text: String(velTo127(v)), unit: `STEP ${two(step + 1)} ${VEL_NAMES[v]}`, course: v / VEL_MAX, value: v };
  }
  const l = lockArg === undefined ? lockOf(pattern.get().locks, inst, step) : lockArg;
  if (!l) return null;
  if (slot.lock === 'snd') {
    if (!l.snd) return null;
    const label = sndLabel(inst, l.snd);
    if (slot.target === 'smpl:sample') {
      const f = soundFamily();
      const list = f ? lockSamples(f) : [];
      const i = list.indexOf(l.snd);
      const n = Math.max(1, list.length - 1);
      return { text: i === 0 ? 'OFF' : label, unit: i > 0 ? `${i} OF ${n}` : i === 0 ? 'SYNTH' : 'OTHER SOUND', course: i > 0 ? i / n : 0, value: Math.max(0, i) };
    }
    const list = lockSounds(inst);
    const i = list.findIndex((x) => x.snd === l.snd);
    const n = Math.max(1, list.length - 1);
    // Sa source en un mot (le nom dit deja la famille d'une autre voix) : SYNTH (909, 808, MM) ou SAMPLE
    const ps = parseSnd(l.snd);
    const synth = !!ps && (KIT_MODELS as readonly string[]).includes(ps.sound);
    return { text: label, unit: synth ? 'SYNTH' : 'SAMPLE', course: Math.max(0, i) / n, value: Math.max(0, i) };
  }
  const id = slot.lock;
  const v = l[id];
  if (v === undefined) return null;
  const e = slot.target as ContEnc;
  const course = potCourse(e, v);
  return { text: encText(e, v, course, isBipolar(e)), unit: encUnit(e, v), course, value: v };
}

/** La valeur du potard de page k en LOCK (son domaine : celui du reglage, un rang de liste pour SOUND) ; null : celle de la voix. */
function lockDialValue(k: number): number | null {
  const slot = pageSlotOf(k);
  const step = lockReadStep();
  const inst = pattern.get().instrument;
  if (!slot || !slot.lock || step < 0 || !inst) return null;
  if (slot.lock === 'vel') return velocity(pattern.get().steps, inst, step);
  const l = lockOf(pattern.get().locks, inst, step);
  if (slot.lock === 'snd') {
    if (slot.target === 'smpl:sample') {
      if (!l?.snd) return null;
      const f = soundFamily();
      const i = f ? lockSamples(f).indexOf(l.snd) : -1;
      return i >= 0 ? i : null;
    }
    // SOUND : le rang du son verrouille, sinon celui du son de la voix (sa famille, ou son propre son)
    const list = lockSounds(inst);
    const f = familyOf(inst as ShotId);
    const want = l?.snd ?? (f ? `${f}:${kit.sound(f)}` : '');
    return Math.max(0, list.findIndex((x) => x.snd === want));
  }
  const v = l?.[slot.lock];
  return v === undefined ? null : v;
}

/** Le nom court et la page de chaque verrou (dans l'ordre des pages). */
const LOCK_NAMES: readonly { key: string; name: string; page: string }[] = [
  { key: 'snd', name: 'SOUND', page: 'SRC' },
  { key: 'tune', name: 'TUNE', page: 'SRC' },
  { key: 'start', name: 'START', page: 'SMPL' },
  { key: 'decay', name: 'DEC', page: 'AMP' },
  { key: 'pan', name: 'PAN', page: 'AMP' },
  { key: 'level', name: 'VOL', page: 'AMP' },
];

/** Les verrous du pas en LOCK, par leur nom de bloc, toutes pages, dans l'ordre des pages : TUNE DEC VOL (l'ecran et le Dock les listent). */
export function lockSummary(step: number): string[] {
  const inst = pattern.get().instrument;
  const l = inst && step >= 0 ? lockOf(pattern.get().locks, inst, step) : null;
  if (!l) return [];
  return LOCK_NAMES.filter((x) => x.key in l).map((x) => x.name);
}

/** Les pages ou le pas a des verrous (SRC AMP) : le pied de l'ecran les dit quand la liste ne tient pas. */
export function lockPages(step: number): string[] {
  const inst = pattern.get().instrument;
  const l = inst && step >= 0 ? lockOf(pattern.get().locks, inst, step) : null;
  if (!l) return [];
  return [...new Set(LOCK_NAMES.filter((x) => x.key in l).map((x) => x.page))];
}

/** Le bloc tourne en LOCK : son verrou pose sur les pas en LOCK ou tenus (ou un message, jamais un geste muet). */
function lockWrite(k: number, slot: PageSlot, v: number): void {
  const inst = pattern.get().instrument;
  const steps = rytmLock.targets();
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  if (slot.scope === 'all') {
    lcdMessage.show(`${slot.label} IS GLOBAL: NO LOCK`);
    return;
  }
  if (!slot.lock) {
    lcdMessage.show(`${slot.label}: NOT LOCKABLE YET`);
    return;
  }
  if (steps.length === 0) return;
  if (slot.lock === 'vel') {
    // VEL : la velocite des pas eux-memes (0 les vide, leurs verrous restent)
    const n = Math.max(0, Math.min(VEL_MAX, Math.round(v)));
    for (const i of steps) pattern.set(inst, i, n);
  } else {
    // Un pas vide qu'on verrouille recoit un coup (fort) : un verrou sans coup ne s'entendrait pas
    for (const i of steps) if (velocity(pattern.get().steps, inst, i) === 0) pattern.set(inst, i, VEL_MAX);
    if (slot.lock === 'snd') {
      const i = Math.max(0, Math.round(v));
      let snd = '';
      if (slot.target === 'smpl:sample') {
        const f = soundFamily();
        const list = f ? lockSamples(f) : [];
        if (list.length < 2) {
          lcdMessage.show(`${inst}: NO SAMPLES`);
          return;
        }
        snd = list[Math.min(list.length - 1, i)];
      } else {
        const list = lockSounds(inst);
        snd = list[Math.min(list.length - 1, i)]?.snd ?? '';
      }
      if (snd) pattern.setLock(inst, steps, 'snd', snd);
      else pattern.clearLock(inst, steps, 'snd');
    } else {
      const id: LockId = slot.lock;
      const e = slot.target as ContEnc;
      // PAN colle au centre, TUNE au demi-ton (comme la valeur de la voix, audio/voicefx.ts)
      const val = id === 'pan' ? (Math.abs(v) < 0.02 ? 0 : v) : id === 'tune' ? Math.round(v * 24) / 24 : v;
      pattern.setLock(inst, steps, id, Math.max(potMin(e), Math.min(1, val)));
    }
  }
  rytmLock.wrote();
  // Deux doigts (un pas tenu, un potard tourne) : le LOCK s'affiche des le premier verrou
  if (rytmLock.get().step < 0) rytmLock.enter(steps[0], false);
  const at = rytmLock.get().step;
  const lv = pageLockView(k, at);
  const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(at + 1)}`;
  lcdMessage.show(lv ? `${who} ${lockName(slot)} ${lv.text}${lv.unit ? `  ${lv.unit}` : ''}` : `${who} ${lockName(slot)}`, POT_UI.readoutMs, true);
  rytmPage.echo(k);
}

/**
 * Deux tapes sur un potard de page (la face, le Dock) : en LOCK, son verrou
 * s'en va (le pas reprend la valeur de la voix) ; sinon, sa valeur de depart.
 */
export function pageKnobReset(k: number): void {
  const id = `p:${k}` as DialId;
  if (!lockMode()) {
    anyDial(id, anyDialReset(id));
    return;
  }
  const slot = pageSlotOf(k);
  const inst = pattern.get().instrument;
  if (!slot || !slot.label || slot.target === null) return;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  if (slot.scope === 'all' || !slot.lock) {
    lockWrite(k, slot, 0);
    return;
  }
  const steps = rytmLock.targets();
  const at = rytmLock.get().step >= 0 ? rytmLock.get().step : steps[0];
  if (slot.lock === 'vel') {
    // VEL : un pas remis a sa velocite d'un appui (fort)
    for (const i of steps) pattern.set(inst, i, VEL_MAX);
  } else pattern.clearLock(inst, steps, slot.lock);
  rytmLock.wrote();
  lcdMessage.show(`STEP ${two(at + 1)} ${lockName(slot)} ${slot.lock === 'vel' ? 'HIGH' : 'UNLOCKED'}`, POT_UI.readoutMs, true);
  rytmPage.echo(k);
}

/**
 * Le LOCK sur le pas i (une tenue, L, le MIDI, le Dock) ; latched : il reste
 * au lacher. L'ecran passe a la vue PAGE (HOME ne montre pas les blocs) et
 * TRIG VEL montre ce pas. false s'il n'a pas pu (EDIT, pas de voix).
 */
export function rytmLockEnter(i: number, latched: boolean): boolean {
  if (editor.get() === 'mm808') {
    lcdMessage.show('CLOSE EDIT TO LOCK A STEP');
    return false;
  }
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return false;
  }
  rytmLock.enter(i, latched);
  rytmPage.select(i);
  rytmPage.setView('page');
  if (presetMode.on('mm808')) presetMode.close();
  const n = lockSummary(i).length;
  lcdMessage.show(`STEP ${two(i + 1)} ${inst} LOCK${n > 0 ? `: ${n} LOCK${n > 1 ? 'S' : ''}` : ''}`, POT_UI.readoutMs, true);
  return true;
}

/** Une tape sur un pas en LOCK : le meme pas en sort, un autre y deplace le LOCK. */
export function rytmLockTap(i: number): void {
  const s = rytmLock.get();
  if (s.step === i) {
    rytmLock.leave();
    lcdMessage.show('LOCK OFF');
    return;
  }
  rytmLockEnter(i, true);
}

/** L, rytm:lock : le LOCK sur ce pas (le pas choisi par defaut), ou hors LOCK s'il y est deja. */
export function rytmLockToggle(i: number = rytmPage.get().sel): void {
  const s = rytmLock.get();
  if (s.step >= 0 && (i < 0 || s.step === i)) {
    rytmLock.leave();
    lcdMessage.show('LOCK OFF');
    return;
  }
  if (i < 0) {
    lcdMessage.show('HOLD A STEP TO LOCK IT');
    return;
  }
  rytmLockEnter(i, true);
}

/** CLEAR en LOCK : les verrous des pas en LOCK (ou tenus) s'en vont ; leurs coups restent. */
export function rytmLockClear(): void {
  const inst = pattern.get().instrument;
  const steps = rytmLock.targets();
  if (!inst || steps.length === 0) return;
  const had = steps.some((i) => lockOf(pattern.get().locks, inst, i) !== null);
  pattern.clearLock(inst, steps);
  rytmLock.wrote();
  const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(steps[0] + 1)}`;
  lcdMessage.show(had ? `${who} LOCKS CLEARED` : `${who} HAS NO LOCKS`);
}

/** Un seul abonnement pour toutes les valeurs des potards (les deux machines, le kit). */
export function subscribeDials(fn: () => void): () => void {
  const offs = [voyParams.subscribe(fn), mix.subscribe(fn), voiceFx.subscribe(fn), kit.subscribe(() => fn()), pattern.subscribe(fn), pattern.fx.subscribe(fn), rytmLock.subscribe(fn)];
  return () => {
    for (const off of offs) off();
  };
}

/** Ligne TRACKS ou MIXTAPES : lecture, pause ou reprise par le moteur SoundCloud. */
export function playItem(track: V2Track, queue: V2Track[]): void {
  sc.play(track, queue);
}

