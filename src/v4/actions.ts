/**
 * Actions partagees (spec 7.2 et 20.6.2) : la couche de saisie, le Dock,
 * le panneau, le clavier et les jumeaux HTML passent tous par ici, pour
 * qu'un objet se comporte pareil d'ou qu'il soit actionne. Ordre d'un coup
 * de pad : le son, puis l'etat (instrument selectionne), puis l'animation.
 * Chaque action relance le contexte audio s'il dort (regle iOS).
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { clock } from './audio/clock';
import { ensure, kitOverride, mix, resume, setChorus, setDelay, setDrive, setLevel, setReverb, setStretch, setSwing, setVoiceFx, trigger } from './audio/drums';
import { TAP_VEL_DEFAULT } from './state/rytmPage';
import { VOICE_FX_DEFAULT, voiceFx, type VoiceParam } from './audio/voicefx';
import { KIT_DEFAULT, KIT_LABEL, KIT_MODELS, KIT_MODEL_LABEL, LAYER_DEFAULT, LAYER_PARAMS, familyOf, isFamily, kit, kitSoundIndex, kitSoundNames, kitSteps, layerRange, layerSteps, mixLevels, mixOf, type KitFamily, type KitId, type KitKnob, type KitModel, type Plays } from './audio/kit';
import { lockOf, parseSnd, type LockId, type LockKey, type StepLock } from './audio/locks';
import { sampleByKey, samplesOf } from './audio/samples';
import { randomBeat, randomColors, type BeatStyle } from './audio/beats';
import { BPM, DELAY_DIVS, INSTRUMENTS, VEL_GAIN, VEL_MAX, VEL_NAMES, delayDiv, isFxSetting, pattern, velocity } from './audio/pattern';
import { sc } from './audio/soundcloud';
import { prepareSynth } from './audio/synth';
import type { Stage } from './scene/renderer';
import { bassExplode, chipsLive, explode, voyExplode, type ExplodeStore } from './state/explode';
import { bassInfos } from './state/bassInfos';
import { voyInfos } from './state/voyInfos';
import { rytmInfos } from './state/rytmInfos';
import { voyEcho } from './voyager/echo';
import { voyPatch } from './voyager/patch';
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
import { RYTM_PAGES, SCREEN_PAGE, SCREEN_TITLE, allScreens, fxDetailBase, fxDetailOf, fxVoiceDetailOf, isFxPage, isFxVoiceDetail, isRytmPage, pageLabel, pageOfAlias, pageSlots, screensOf, tabWord, type FxPageId, type PageSlot, type RytmPageId, type RytmScreenId, type SlotTarget } from './rytm/pages';
import { encText, encUnit, kitUnit, kitUnitAt, layerText, layerUnit, v127Text, velTo127, velWord, type LayerDial } from './rytm/values';
import { section } from './state/section';
import { voices } from './state/voices';
import { bassLoad } from './state/bassload';
import { BOARD_CHIPS, GLOBAL_ENCODERS, MOBILE_QUERY, PAGE_KNOB_LETTERS, POT_UI, isPage, VOICE_PARAM, encLabel, isBipolar, isVoiceEnc, potCourse, potMin, type ChipId, type EncId, type Inst, type PageId, type SectionId } from './theme';
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
  // selectionner") : la voix est choisie, sans coup ; a l'arret, elle sonne comme avant, a la velocite des nouveaux
  // pas de la voix (VEL de VOICE, 2026-10-09 : HIGH au depart, le coup d'avant)
  if (!clock.running) trigger(inst, undefined, false, undefined, VEL_GAIN[rytmPage.tapVel(inst)] ?? 1);
  selectVoice(inst);
  stage?.pads.press(inst);
}

/** Mode SOLO : la voix passe en solo, ou en sort ; a une voix (ONE), le mode retombe ; l'ecran le dit. */
function soloVoice(inst: Inst): void {
  voices.toggleSolo(inst);
  const v = voices.get();
  if (!v.soloMulti) voices.disarm('solo');
  lcdMessage.show(v.solo.includes(inst) ? `SOLO ${inst}` : `${inst} SOLO OFF`);
}

/** Mode MUTE : une voix coupee ou rendue ; a une voix (ONE), le mode retombe ; l'ecran le dit. */
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
  // La liste des sons est ouverte : elle passe a la voix touchee (et reste un peu), la meme liste (revue de R3 : SAMPLE de
  // SMPL redevenait la liste SOUND d'avant)
  if (lcdSamples.get()) lcdSamples.show(undefined, lcdSamples.kind());
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
 * INFOS du MM-RYTM allume (R4), une commande touchee au doigt (la face, la
 * feuille de sa carte, le Dock : dock) : sa carte, et la commande n'agit pas ;
 * sauf pour naviguer, sans un son : une touche de page (sur la face, au pied
 * de l'ecran, dans le Dock) tourne quand meme la page, un pad choisit sa voix
 * (jamais deselectionnee, ni MUTE ni SOLO). Au doigt, c'est le seul moyen de
 * lire les reglages des autres pages et des autres voix ; la revue de R4 :
 * une tape a travers la feuille sautait cette navigation, les cartes
 * suivantes parlaient d'une autre page. true : INFOS l'a prise ; eteint,
 * false (la commande agit).
 */
export function rytmInfoTap(hotspot: string, dock = false): boolean {
  if (!rytmInfos.isOn()) return false;
  if (dock) rytmInfos.dock(hotspot);
  else rytmInfos.show(hotspot);
  const pk = /^(?:pkey|lcd-tab)-([a-z]+)$/.exec(hotspot);
  if (pk && isRytmPage(pk[1])) rytmPage.setPage(pk[1]);
  const pad = /^pad-([A-Z]+)$/.exec(hotspot);
  const inst = pad && (INSTRUMENTS as readonly string[]).includes(pad[1]) ? (pad[1] as Inst) : null;
  if (inst && pattern.get().instrument !== inst) tuneVoice(inst);
  return true;
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
  // Un pas vide recoit la velocite des nouveaux pas de la voix (2026-10-09 : HIGH au depart ; sans bloc depuis le 2026-10-10) ; un pas pose
  // passe au cran d'en dessous comme avant (MID, LOW, vide)
  if (velocity(pattern.get().steps, inst, i) === 0) pattern.set(inst, i, rytmPage.tapVel(inst));
  else pattern.toggle(inst, i);
  rytmPage.select(i);
  // Le geste des verrous se dit a chaque pas pose (2026-10-08, Mika : "je ne comprends toujours pas comment mettre des parameter locks")
  lcdMessage.show(`${stepLine(inst, i)}  HOLD: P-LOCK`);
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
  // La vue PAGE (2026-10-08) : TRIG en coup d'oeil ; plus de bloc VEL depuis le 2026-10-10 (fusionne dans VOL) :
  // touchPage ne trouve rien a cerner, l'ecran dit la velocite du pas
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
 * MUTE (2026-10-03, Mika ; refait le 2026-10-07, puis le 2026-10-09, Mika :
 * "Dans RYTM quand on appuie deux fois sur MUTE on peut selectionner
 * plusieurs Voice pour les muter.. si une seule fois ca veut dire que c'est
 * juste un voice") : une machine a trois etats, sans fenetre de temps (deux
 * appuis, aussi lents qu'on veut) :
 * - OFF, MUTE : ONE (le temoin clignote, l'ecran dit MUTE: TAP A VOICE / MUTE
 *   AGAIN: SEVERAL) ; la voix touchee ensuite se coupe (ou revient) et le mode
 *   retombe a OFF ;
 * - ONE, MUTE encore : MULTI (le temoin fixe) ; chaque voix touchee se coupe
 *   ou revient, le mode reste, l'ecran liste les voix coupees ;
 * - MULTI, MUTE : OFF, les voix coupees le restent (comme une Elektron ; le
 *   temoin a peine allume tant qu'il y en a, leurs pads rouges a peine) ;
 * - MUTE tenu 600 ms (MODE_HOLD_MS, n'importe quel etat) : toutes les voix
 *   reviennent (ALL VOICES ON) ; Echap sort du mode (les voix coupees le
 *   restent) ; M au clavier (Maj + M : SOLO).
 * La liste des voix coupees et celle du solo sont independantes : armer SOLO
 * n'efface plus les mutes (le solo passe avant eux tant qu'il dure). Plus de
 * "voix puis MUTE" (le raccourci de 1.5 s du 2026-10-04 coupait la voix
 * touchee juste avant, pas celle qu'on touchait apres). Renvoie l'etat du
 * temoin (allume ou non).
 */
export function muteToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('mute');
  return modeTap('mute');
}

/** SOLO (2026-10-04 ; refait le 2026-10-07 et le 2026-10-09) : la meme machine a etats que MUTE. */
export function soloToggle(stage: Stage | null = null): boolean {
  resume();
  stage?.pressButton('solo');
  return modeTap('solo');
}

/** MUTE (SOLO) tenu au moins ce temps : toutes les voix reviennent (la face, le Dock, le clavier). */
export const MODE_HOLD_MS = 600;
/** Les messages des modes restent un peu plus que les autres ; l'ecran garde ensuite le mode et son aide (scene/screen.ts). */
const MODE_MSG_MS = 1200;

function modeTap(k: 'mute' | 'solo'): boolean {
  const v = voices.get();
  const word = k === 'mute' ? 'MUTE' : 'SOLO';
  const on = k === 'mute' ? v.muteMode : v.soloMode;
  const multi = k === 'mute' ? v.muteMulti : v.soloMulti;
  if (!on) {
    voices.arm(k, false);
    lcdMessage.show(`${word}: TAP A VOICE`, MODE_MSG_MS);
    return true;
  }
  if (!multi) {
    voices.arm(k, true);
    lcdMessage.show(`MULTI ${word}: TAP VOICES`, MODE_MSG_MS);
    return true;
  }
  voices.disarm(k);
  const list = k === 'mute' ? voices.get().muted : voices.get().solo;
  lcdMessage.show(list.length ? `${word} OFF  ${list.join(' ')} ${k === 'mute' ? 'STAY MUTED' : 'STAY SOLO'}` : `${word} OFF`, MODE_MSG_MS);
  return list.length > 0;
}

/** MUTE (SOLO) tenu (2026-10-09) : le mode s'eteint et toutes ses voix reviennent ; l'ecran le dit. */
export function modeHold(k: 'mute' | 'solo'): void {
  resume();
  voices.release(k);
  lcdMessage.show(k === 'mute' ? 'ALL VOICES ON' : 'SOLO OFF: ALL VOICES', MODE_MSG_MS);
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
  // Tout a 0 (2026-10-10, Mika : "quand j'appuie sur CLEAR je veux tout a 0, la je vois des FX qui restent") : les
  // GLOBAL FX (SWING droit, STRETCH au centre, BIT et COMP OFF) et les FX de chaque voix ; le son des voix reste
  pattern.fx.set({ drive: 0, chorus: 0, delay: 0, reverb: 0, swing: 0, bits: 0, comp: 0 });
  setStretch(0);
  for (const inst of INSTRUMENTS) for (const fp of ['dist', 'chorus', 'delay', 'reverb'] as const) voiceFx.set(inst, fp, 0);
  lcdMessage.show('CLEARED · FX OFF');
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

/** Les potards de la machine qui ne reglent que la couche SYNTH (R3), et leur famille : un message quand elle est a 0. */
const SYNTH_ONLY: Partial<Record<KitKnob, KitFamily>> = { tune: 'bd', decay: 'bd', sweep: 'bd', sdtune: 'sd', sddecay: 'sd', sdtone: 'sd' };

/** Le meme pour un TWEAK du kit : KICK TUNE 64  52 HZ ; un choix de son ou GATE, son nom. */
function kitReadout(id: KitId): string {
  if (isFamily(id) || id === 'gate') return kit.readout(id);
  const sd = id === 'snappy' || id === 'sdtune' || id === 'sddecay' || id === 'sdtone';
  const label = `${sd ? 'SNARE' : 'KICK'} ${KIT_LABEL[id]}`;
  // La couche SYNTH a 0 (R3, le kit de depart joue les samples de Mika) : ce potard ne s'entend pas encore, l'ecran le dit
  const f = SYNTH_ONLY[id];
  const off = f && kit.layerOf(f).syn <= 0 ? '  SYNTH OFF: LEVEL H' : '';
  return `${label} ${v127Text(kit.value(id))}  ${kitUnit(id)}${off}`;
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
export function dial(id: EncId, v: number, popup = false): void {
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
  // DLY TIME (a crans : ses divisions) et DLY FB (2026-10-09, les encodeurs G et H)
  else if (id === 'dtime') pattern.fx.set({ dtime: Math.round(Math.max(0, Math.min(1, v)) * (DELAY_DIVS.length - 1)) / (DELAY_DIVS.length - 1) });
  else if (id === 'dfb') pattern.fx.set({ dfb: v });
  else if (id === 'bits') pattern.fx.set({ bits: v });
  else if (id === 'comp') pattern.fx.set({ comp: v });
  else if (isFxSetting(id)) pattern.fx.set({ [id]: v });
  else setChorus(v);
  // popup : un encodeur du desktop, son popup dit la valeur, seul (revue du 2026-10-09 : la ligne du pied en disait une
  // autre au meme instant, a la place des verrous du pas en P-LOCK)
  // Un FX global tourne (2026-10-10, Mika : "on tombe sur une page d'edition de ces FX, claire") : l'ecran passe sur
  // GLOBAL FX, le bloc tourne cerne (touchPage plus bas) ; un FX qui a sa page (DIST CHORUS DELAY REVERB BIT COMP, Mika :
  // "ca doit afficher les configurations que je peux avoir pour DELAY") : sa page, sa quantite cernee ; STRETCH et
  // SWING : GLOBAL FX
  if (popup) {
    const inst = pattern.get().instrument;
    const fd = fxDetailOf(id);
    const t = screensOf('fx', inst).indexOf('fxg');
    if (fd) rytmPage.openFx(fd, inst);
    else if (t >= 0) rytmPage.setTab('fx', t, inst);
    else rytmPage.popup(id);
  }
  else lcdMessage.show(readout(id, dialValue(id), null), POT_UI.readoutMs, true);
  touchPage(id, pattern.get().instrument);
}

/**
 * Un encodeur du desktop tourne (2026-10-09, Mika : "en desktop tu les laisses
 * mais par contre ils ne servent qu'a faire les modifs des FX globaux de la
 * machine") : son FX global (theme.ts GLOBAL_ENCODERS), jamais un verrou, meme
 * en P-LOCK ; l'ecran montre sa valeur un instant (le popup : son nom, 0 a 127,
 * son unite) sans changer de page.
 */
export function globalDial(k: number, v: number): void {
  const id = GLOBAL_ENCODERS[k];
  if (!id) return;
  dial(id, v, true);
}

/** La cible fixe de l'encodeur k du desktop (2026-10-09) : son FX global. */
export const globalEncId = (k: number): EncId | null => GLOBAL_ENCODERS[k] ?? null;

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
    case 'dtime':
      return pattern.fx.get().dtime;
    case 'dfb':
      return pattern.fx.get().dfb;
    case 'bits':
      return pattern.fx.get().bits;
    case 'comp':
      return pattern.fx.get().comp;
    default:
      if (isFxSetting(id)) return pattern.fx.get()[id];
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
    lcdMessage.show('P-LOCK OFF');
    return true;
  }
  // MUTE et SOLO (2026-10-09) : Echap sort du mode, les voix coupees (en solo) le restent ; seulement devant le MM-RYTM
  // (revue : depuis le MM-BASS, la premiere Echap desarmait le RYTM au lieu d'eteindre BASS INFOS)
  const vm = voices.get();
  if ((vm.muteMode || vm.soloMode) && focus.get() === 'mm808') {
    const k = vm.muteMode ? 'mute' : 'solo';
    voices.disarm(k);
    lcdMessage.show(`${k === 'mute' ? 'MUTE' : 'SOLO'} OFF`);
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
  // INFOS du MM-ARP (2026-10-08, la touche i du grand ecran) : de meme, quand on le voit
  if (voyInfos.isOn() && focus.get() === 'voy') {
    voyInfos.set(false);
    return true;
  }
  // INFOS du MM-RYTM (R4, la touche i de son ecran) : de meme, apres le LOCK et EDIT, avant le capot
  if (rytmInfos.isOn() && focus.get() === 'mm808') {
    rytmInfos.set(false);
    return true;
  }
  // La page d'un FX global (2026-10-10) : Echap revient a GLOBAL FX, quand on la voit (devant le MM-RYTM, vue PAGE)
  if (focus.get() === 'mm808' && rytmFxClose()) return true;
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

/** CLEAR : plus d'accord, l'arpege s'arrete, les effets a sec. */
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
  // Les effets a sec (2026-10-10, Mika : "quand j'appuie sur CLEAR je veux tout a 0 et la je vois qu'il y a des FX qui
  // restent") : OVERDRIVE, CHORUS, DELAY, REVERB a 0 ; VOLUME, les oscillateurs et le filtre restent
  for (const id of ['dist', 'chorus', 'delay', 'reverb'] as const) voyParams.set(id, 0);
  voyMsg.show('CLEARED · FX OFF');
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
  // L'en-tete du grand ecran (2026-10-08) : RANDOM et son style, a la place du nom d'un preset
  voyPatch.random(r.style);
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

/**
 * Un potard du MM-VOYAGER (0 a 1) ; l'ecran dit sa valeur. Depuis le grand
 * ecran (2026-10-08) : son echo (voyager/echo.ts, le nom, la valeur de 0 a
 * 127, l'unite, le dessin) a la place du message CUTOFF 64 %.
 */
export function voyDial(id: VoyKnobId, v: number): void {
  resume();
  // MODE, RANGE et NOTES fabriquent la suite : la tourner repasse en AUTO (voyager/seq.ts)
  if (voyParams.set(id, v) && (id === 'mode' || id === 'range' || id === 'notes')) seq.auto();
  voyEcho.touch(id);
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
export type DialId = EncId | `v:${VoyKnobId}` | `r:${KitId}` | `p:${number}` | `l:${LayerDial}`;

const voyId = (id: DialId): VoyKnobId | null => (id.startsWith('v:') ? (id.slice(2) as VoyKnobId) : null);
export const kitIdOf = (id: DialId): KitId | null => (id.startsWith('r:') ? (id.slice(2) as KitId) : null);

/* ---------------- les couches SYNTH et SAMPLE du MM-RYTM (2026-10-08, l'etape R3) ---------------- */

/*
 * Mika (2026-10-08) : "une machine pour la configuration a la main du Voice
 * pour avoir des samples et aussi une configuration digitale du BD ou SD..
 * comme la ANALOG Rytm ou on peut mettre des samples mais le kick peut etre
 * parametre comme une machine". l:<reglage> : un reglage de couche de la
 * voix choisie (sa famille, audio/kit.ts) : la MACHINE de la couche SYNTH
 * (l:mach), les niveaux (l:syn, l:lev), la couche SAMPLE (l:tune, l:fine,
 * l:start, l:len, l:rev) ; les potards de la machine restent r:<potard>.
 */
const LAYER_DIALS: readonly LayerDial[] = ['mach', ...LAYER_PARAMS];
/** Le reglage de couche d'un potard (l:<reglage>), null pour un autre. */
export const layerIdOf = (id: DialId | SlotTarget): LayerDial | null =>
  id.startsWith('l:') && (LAYER_DIALS as readonly string[]).includes(id.slice(2)) ? (id.slice(2) as LayerDial) : null;
/** Son nom dans un message. */
const LAYER_NAME: Readonly<Record<LayerDial, string>> = {
  mach: 'MACHINE',
  syn: 'SYNTH LEVEL',
  lev: 'SAMPLE LEVEL',
  tune: 'SAMPLE TUNE',
  fine: 'SAMPLE FINE',
  start: 'SAMPLE START',
  len: 'SAMPLE LEN',
  rev: 'SAMPLE REV',
};

/** La valeur d'un reglage de couche d'une famille (la MACHINE : son rang, 0 a 2 ; null : CY, sans couches). */
function layerValueOf(f: KitFamily | null, p: LayerDial): number {
  if (!f) return p === 'mach' ? KIT_MODELS.indexOf('mm') : LAYER_DEFAULT[p];
  return p === 'mach' ? KIT_MODELS.indexOf(kit.get().model[f]) : kit.layerOf(f)[p];
}
/** Celle de la voix choisie. */
const layerValue = (p: LayerDial): number => layerValueOf(soundFamily(), p);
const layerSpan = (p: LayerDial): [number, number] => (p === 'mach' ? [0, KIT_MODELS.length - 1] : layerRange(p));
const layerNotches = (p: LayerDial): number => (p === 'mach' ? KIT_MODELS.length : layerSteps(p));
/** Son depart : celui du kit de depart (BD et SD : SYNTH 0, leurs samples). */
function layerReset(p: LayerDial): number {
  const f = soundFamily();
  if (!f) return layerValue(p);
  return p === 'mach' ? KIT_MODELS.indexOf(KIT_DEFAULT.model[f]) : kit.layerDef(f, p);
}
/**
 * Ce que la couche SAMPLE de la voix joue (LEN se dit en ms quand le fichier
 * est la) ; lock : le pas montre (revue de R3 : son sample, son START et son
 * TUNE verrouilles comptent dans la longueur de LEN).
 */
const sampleCtx = (f: KitFamily, lock?: Readonly<StepLock> | null): { key: string; layer: ReturnType<typeof kit.layerOf> } | undefined => {
  const ov = lock ? kitOverride(lock) : null;
  const snd = ov && ov.sample !== undefined ? ov.sample : kit.get().sample[f];
  if (!snd) return undefined;
  return { key: snd, layer: ov?.layer ? { ...kit.layerOf(f), ...ov.layer } : kit.layerOf(f) };
};
/** Sa ligne d'unite, ce qui l'empeche de s'entendre compris (la couche muette) ; f : la famille (la voix choisie). */
function layerUnitNow(p: LayerDial, f: KitFamily | null = soundFamily()): string {
  if (!f) return '';
  const v = layerValueOf(f, p);
  if (p === 'mach') return kit.layerOf(f).syn > 0 ? 'SYNTH' : 'SYNTH OFF';
  return layerUnit(p, v, sampleCtx(f));
}

/** Ce que dit l'ecran quand un reglage de couche tourne : BD SAMPLE TUNE +2  2ND ; et pourquoi il ne s'entend pas. */
function layerReadout(p: LayerDial, inst: Inst | string, f: KitFamily): string {
  const l = kit.layerOf(f);
  const smp = !!kit.get().sample[f];
  let why = '';
  if (p !== 'mach' && p !== 'syn' && !smp) why = '  SAMPLE OFF';
  else if ((p === 'syn' && l.syn <= 0 && (!smp || l.lev <= 0)) || (p === 'lev' && l.lev <= 0 && l.syn <= 0)) why = '  VOICE SILENT';
  // La MACHINE : son nom, et la couche a rallumer si elle est muette (l'unite SYNTH OFF ne se repete pas)
  if (p === 'mach') return `${inst} MACHINE ${layerText(p, layerValueOf(f, p))}${l.syn <= 0 ? '  SYNTH OFF: LEVEL H' : ''}`;
  return `${inst} ${LAYER_NAME[p]} ${layerText(p, layerValueOf(f, p))}  ${layerUnitNow(p, f)}${why}`;
}

/** Les familles dont les couches ont des cibles MIDI (rytm:layer:<famille>:<reglage>) ; celles qui ont des samples, toutes. */
export const LAYER_TARGET_FAMS: readonly KitFamily[] = ['bd', 'sd', 'hh', 'cp', 'tom'];
/** Ce qu'une cible de couche regle : un reglage de couche, ou l'echantillon de la couche SAMPLE. */
export type LayerTarget = LayerDial | 'sample';

/** Sa course (0 a 1 pour le MIDI) : la MACHINE en trois crans, TUNE et FINE autour du centre, SAMPLE OFF puis ses samples. */
export function layerTargetSteps(f: KitFamily, p: LayerTarget): number {
  if (p === 'sample') return samplesOf(f).length + 1;
  return layerNotches(p);
}
/** La valeur 0 a 1 d'une cible de couche (le Roto la relit). */
export function layerTargetValue(f: KitFamily, p: LayerTarget): number {
  if (p === 'sample') {
    const n = samplesOf(f).length;
    const key = kit.get().sample[f];
    const j = key ? samplesOf(f).findIndex((x) => x.key === key) + 1 : 0;
    return n > 0 ? Math.max(0, j) / n : 0;
  }
  const [lo, hi] = layerSpan(p);
  return hi > lo ? (layerValueOf(f, p) - lo) / (hi - lo) : 0;
}

/**
 * Une cible MIDI de couche tourne (revue de R3, 2026-10-08) : la couche d'une
 * famille sans choisir sa voix (le Roto-Control : le TUNE du sample du kick,
 * son LEN, le niveau de la synthese...). v : 0 a 1 ; l'ecran dit le reglage,
 * la page le montre si elle est affichee.
 */
export function kitLayerDial(f: KitFamily, p: LayerTarget, v: number): void {
  resume();
  const who = KIT_LABEL[f];
  const c = Math.max(0, Math.min(1, v));
  if (p === 'sample') {
    const list = samplesOf(f);
    if (list.length === 0) {
      lcdMessage.show(`${who}: NO SAMPLES`);
      return;
    }
    const j = Math.round(c * list.length);
    kit.setSample(f, j === 0 ? null : list[j - 1].key);
    lcdMessage.show(`${who} SAMPLE ${j === 0 ? 'OFF' : kit.sampleLabel(f)}${j === 0 ? '' : `  ${j} OF ${list.length}`}`, POT_UI.readoutMs, true);
  } else {
    const [lo, hi] = layerSpan(p);
    const x = lo + c * (hi - lo);
    if (p === 'mach') kit.setMachine(f, KIT_MODELS[Math.max(0, Math.min(KIT_MODELS.length - 1, Math.round(x)))]);
    else kit.setLayer(f, p, x);
    lcdMessage.show(layerReadout(p, who, f), POT_UI.readoutMs, true);
  }
  const inst = pattern.get().instrument;
  if (inst && familyOf(inst as ShotId) === f) touchPage(p === 'sample' ? 'smpl:sample' : `l:${p}`, inst);
}

/** Un reglage de couche tourne (un potard de page, un jumeau) : la voix choisie, sa famille. */
function layerDial(p: LayerDial, v: number): void {
  resume();
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
  // La MACHINE : trois crans, son nom dans le bloc et au pied suffit (pas de liste)
  if (p === 'mach') kit.setMachine(f, KIT_MODELS[Math.max(0, Math.min(KIT_MODELS.length - 1, Math.round(v)))]);
  else kit.setLayer(f, p, v);
  lcdMessage.show(layerReadout(p, inst, f), POT_UI.readoutMs, true);
  touchPage(`l:${p}`, inst);
}

/* ---------------- les potards de page du MM-RYTM (2026-10-08) ---------------- */

/** Le rang (0 a 7) d'un potard de page, -1 pour un autre potard. */
export const pageKnobOf = (id: DialId): number => (id.startsWith('p:') ? Number(id.slice(2)) : -1);

/** L'ecran affiche (2026-10-09 : la page et son onglet) pour la voix choisie. */
export function curScreen(): RytmScreenId {
  return rytmPage.screen(pattern.get().instrument);
}

/** Ce que porte le potard de page k sur l'ecran affiche, pour la voix choisie. */
export function pageSlotOf(k: number): PageSlot | null {
  return pageSlots(curScreen(), pattern.get().instrument)[k] ?? null;
}

/** La cible du potard de page k (un DialId, la velocite, le son ou le melange de VOICE), null : vide ou un dessin. */
export function pageTarget(k: number): SlotTarget | null {
  const s = pageSlotOf(k);
  return s && !s.graph ? s.target : null;
}

/** Les echantillons de la famille de la voix choisie, 0 sans voix ni famille. */
function sampleCount(): number {
  const f = soundFamily();
  return f ? Math.max(0, kitSteps(f) - KIT_MODELS.length) : 0;
}

/** SMPL SAMPLE (l'ancien, le MIDI et l'INFOS le connaissent) : 0 (OFF) ou le rang de l'echantillon de la couche, 1 a n. */
function sampleValue(): number {
  const f = soundFamily();
  if (!f) return 0;
  const key = kit.get().sample[f];
  return key ? samplesOf(f).findIndex((x) => x.key === key) + 1 : 0;
}

/**
 * SMPL SAMPLE tourne (2026-10-08, revue de R1 ; la couche SAMPLE depuis R3) :
 * OFF coupe la couche SAMPLE, un cran plus loin l'un des echantillons de la
 * famille ; la liste s'ouvre a l'ecran. Plus sur aucune page depuis le
 * 2026-10-09 (SOUND de VOICE le remplace) : le chemin reste pour ce qui le vise.
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
  kit.setSample(f, j === 0 ? null : samplesOf(f)[j - 1].key);
  lcdSamples.show(undefined, 'sample');
  if (j === 0) lcdMessage.show(kit.layerOf(f).syn > 0 ? `${inst} SAMPLE OFF: SYNTH ONLY` : `${inst} SILENT: SOUND UP`, POT_UI.readoutMs, true);
  touchPage('smpl:sample', inst);
}

/** SMPL SAMPLE ecrit : OFF, ou le nom de l'echantillon de la couche SAMPLE ; '--' sans echantillon a choisir. */
function sampleText(): string {
  const f = soundFamily();
  if (!f || sampleCount() === 0) return '--';
  return sampleValue() === 0 ? 'OFF' : kit.sampleLabel(f);
}

/** Sa ligne d'unite : SYNTH 909 (OFF : le son de synthese joue), 2 OF 6. */
function sampleUnit(): string {
  const f = soundFamily();
  const n = sampleCount();
  if (!f) return '';
  if (n === 0) return 'NO SAMPLES';
  const j = sampleValue();
  return j === 0 ? (kit.layerOf(f).syn > 0 ? `SYNTH ${KIT_MODEL_LABEL[kit.get().model[f]]}` : 'VOICE SILENT') : `${j} OF ${n}`;
}

/* ---------------- VOICE : le son, son melange, la velocite des nouveaux pas (2026-10-09) ---------------- */

/*
 * Mika (2026-10-09) : "Je ne comprends pas TRIG ca doit etre le parametre de
 * la Voice ici.. donc on doit voir c'est quoi le sample.. je veux merge SRC
 * SMPL et TRIG !". SOUND : une seule liste, OFF, 909, 808, MM, puis les
 * samples de la famille ; ce que la voix joue, en grand (BLUEPRINT, 909,
 * BLUEPRINT + 909 quand les deux couches jouent). Le choisir garde ce qui a un
 * sens : un autre sample garde la synthese posee dessous (MIX) ; une machine
 * joue seule (le sample reste en memoire, MIX le ramene) ; OFF fait taire la
 * voix. MIX (VOICE SYNTH) : la part des deux couches, la plus forte reste a son
 * niveau (audio/kit.ts mixOf, mixLevels) ; un vieux kit aux deux LEVEL sonne
 * pareil (MIX lu de ses deux niveaux).
 */

/** Un son de la liste de SOUND : OFF, une machine, un sample (de la famille ; en P-LOCK aussi des autres), le son propre de CY. */
export interface VoiceSound {
  kind: 'off' | 'mach' | 'smp' | 'own';
  /** la machine (909, 808, mm) ou la cle du sample */
  key: string;
  /** la famille du sample (une autre que celle de la voix : un sample lock) */
  fam: KitFamily | null;
  label: string;
}

const voiceSoundCache = new Map<string, readonly VoiceSound[]>();

/**
 * La liste de SOUND d'une voix : OFF, 909, 808, MM, ses samples ; lock (le
 * P-LOCK) : puis les samples des autres familles, leur famille devant (SD PSY
 * 02, le sample lock). CY (sans famille) : son propre son, puis en P-LOCK les
 * samples de toutes.
 */
export function voiceSounds(inst: Inst, lock = false): readonly VoiceSound[] {
  const sig = `${inst}|${lock ? 1 : 0}|${LOCK_FAMS.map((f) => samplesOf(f).length).join(',')}`;
  let out = voiceSoundCache.get(sig);
  if (out) return out;
  const own = familyOf(inst as ShotId);
  const list: VoiceSound[] = [];
  if (own) {
    list.push({ kind: 'off', key: 'off', fam: own, label: 'OFF' });
    for (const m of KIT_MODELS) list.push({ kind: 'mach', key: m, fam: own, label: KIT_MODEL_LABEL[m] });
    for (const x of samplesOf(own)) list.push({ kind: 'smp', key: x.key, fam: own, label: x.label });
  } else list.push({ kind: 'own', key: '', fam: null, label: inst });
  if (lock) for (const f of LOCK_FAMS) if (f !== own) for (const x of samplesOf(f)) list.push({ kind: 'smp', key: x.key, fam: f, label: `${FAM_TAG[f]} ${x.label}` });
  out = list;
  voiceSoundCache.set(sig, out);
  return out;
}

/** Le rang de ce que joue p (une voix, un pas) dans une liste de SOUND. */
function voiceSoundAt(list: readonly VoiceSound[], p: Readonly<Plays>): number {
  if (p.smp && p.sample) {
    const i = list.findIndex((x) => x.kind === 'smp' && x.key === p.sample);
    if (i >= 0) return i;
  }
  if (p.synth) {
    const i = list.findIndex((x) => x.kind === 'mach' && x.key === p.model);
    if (i >= 0) return i;
  }
  return 0;
}

/** Ce que joue p, en grand : BLUEPRINT, 909, BLUEPRINT + 909, OFF ; CY : son nom. */
export function voiceSoundText(inst: Inst, p: Readonly<Plays>): string {
  const own = familyOf(inst as ShotId);
  if (!own && !p.from) return inst;
  if (!p.synth && !p.smp) return 'OFF';
  const smp = p.sample ? (sampleByKey(p.sample)?.label ?? 'SAMPLE') : '';
  const tag = p.from ? `${FAM_TAG[p.from as KitFamily] ?? p.from.toUpperCase()} ` : '';
  if (p.smp && p.synth) return own ? `${tag}${smp} + ${KIT_MODEL_LABEL[p.model]}` : `${tag}${smp} + ${inst}`;
  if (p.smp) return `${tag}${smp}`;
  return own ? KIT_MODEL_LABEL[p.model] : inst;
}

/** Sa ligne d'unite : SAMPLE 1 OF 6, SAMPLE + SYNTH, SYNTH, VOICE SILENT ; CY : ONE SOUND. */
export function voiceSoundUnit(inst: Inst, p: Readonly<Plays>): string {
  const own = familyOf(inst as ShotId);
  if (!own && !p.from) return 'ONE SOUND';
  if (!p.synth && !p.smp) return 'VOICE SILENT';
  if (p.smp && p.synth) return 'SAMPLE + SYNTH';
  if (p.smp) {
    if (p.from) return `FROM ${FAM_TAG[p.from as KitFamily] ?? p.from.toUpperCase()}`;
    const list = own ? samplesOf(own) : [];
    const j = list.findIndex((x) => x.key === p.sample);
    return j >= 0 ? `SAMPLE ${j + 1} OF ${list.length}` : 'SAMPLE';
  }
  return 'SYNTH';
}

/** Le niveau des couches a garder quand le son change : le plus fort des deux (1 si la voix se taisait). */
const layerTop = (syn: number, lev: number): number => (Math.max(syn, lev) > 0 ? Math.max(syn, lev) : 1);

/** SOUND tourne (hors P-LOCK) : la voix joue ce son (audio/kit.ts setVoice), la liste s'ouvre. */
function voiceSoundDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  const f = soundFamily();
  if (!f) {
    lcdMessage.show(`${inst} HAS ONE SOUND: P-LOCK A SAMPLE`);
    return;
  }
  const list = voiceSounds(inst);
  const s = list[Math.max(0, Math.min(list.length - 1, Math.round(v)))];
  const k = kit.get();
  const l = k.layer[f];
  const top = layerTop(l.syn, l.lev);
  const smpOn = !!k.sample[f] && l.lev > 0;
  if (s.kind === 'off') kit.setVoice(f, { syn: 0, lev: 0 });
  else if (s.kind === 'mach') kit.setVoice(f, { model: s.key as KitModel, syn: top, lev: 0 });
  // Un sample : il garde la synthese posee dessous s'il y en avait un (MIX) ; apres une machine, il joue seul a son niveau
  else if (s.kind === 'smp') kit.setVoice(f, smpOn ? { sample: s.key } : { sample: s.key, syn: 0, lev: top });
  lcdSamples.show(undefined, 'voice');
  touchPage('voice:sound', inst);
}

/** Le son de la voix choisie dans sa liste (hors P-LOCK). */
function voiceSoundValue(): number {
  const inst = pattern.get().instrument;
  const f = soundFamily();
  return inst && f ? kit.voiceIndex(f) : 0;
}

/** MIX de ce que joue p : 0 la synthese seule, 1 le sample seul (sans sample du tout : 0). */
export function mixValueOf(p: Readonly<Plays>): number {
  return p.sample ? mixOf(p.syn, p.lev) : 0;
}

/**
 * MIX ecrit (revue du 2026-10-09 : SYN, +43 et BOTH, trois facons pour un
 * meme reglage) : toujours le penchant, de -64 (la synthese seule) a +63 (le
 * sample seul), 0 les deux pleins, comme les autres reglages bipolaires ;
 * OFF quand la voix se tait (les deux couches a 0).
 */
export function mixText(p: Readonly<Plays>): string {
  if (!p.synth && !p.smp) return 'OFF';
  return v127Text(mixValueOf(p), true);
}
/** Sa ligne d'unite : les deux niveaux, 0 a 127 ; la voix muette le dit. */
export const mixUnit = (p: Readonly<Plays>): string =>
  !p.synth && !p.smp ? 'VOICE SILENT' : p.sample ? `SYN ${v127Text(p.syn)} SMP ${v127Text(p.lev)}` : 'NO SAMPLE: SMP ADDS ONE';

/** Le premier sample de la famille, celui du kit de depart d'abord (MIX qui pose un sample sous une machine seule). */
function firstSampleOf(f: KitFamily): string | undefined {
  return KIT_DEFAULT.sample[f] ?? samplesOf(f)[0]?.key;
}

/** MIX tourne (hors P-LOCK) : les deux niveaux, le plus fort a sa place ; sans sample, le premier de la famille vient dessous. */
function voiceMixDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  const f = soundFamily();
  if (!f || samplesOf(f).length === 0) {
    lcdMessage.show(`${inst}: NO SAMPLES TO MIX`);
    return;
  }
  const k = kit.get();
  const l = k.layer[f];
  const m = Math.max(0, Math.min(1, v));
  const lv = mixLevels(m, layerTop(l.syn, l.lev));
  const sample = !k.sample[f] && m > 0 ? firstSampleOf(f) : undefined;
  kit.setVoice(f, { syn: lv.syn, lev: lv.lev, ...(sample ? { sample } : {}) });
  const p = kit.playsWith(inst as ShotId, null);
  lcdMessage.show(`${inst} MIX ${mixText(p)}  ${voiceSoundText(inst, p)}`, POT_UI.readoutMs, true);
  touchPage('voice:mix', inst);
}

/**
 * VEL hors P-LOCK (2026-10-09) : la velocite des nouveaux pas de la voix (et de son pad), 1 a 9. Plus de bloc VEL
 * depuis le 2026-10-10 (fusionne dans VOL) : seul un bloc step:vel l'appellerait encore.
 */
function tapVelDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  const n = Math.max(1, Math.min(VEL_MAX, Math.round(v)));
  rytmPage.setTapVel(inst, n);
  lcdMessage.show(`${inst} NEW STEPS VEL ${velTo127(n)}  ${velWord(n)}`, POT_UI.readoutMs, true);
  touchPage('step:vel', inst);
}

/**
 * Un potard de page tourne : il regle ce que son bloc montre ; un bloc vide
 * (ou un dessin) le dit a l'ecran (jamais un geste qui ne fait rien en
 * silence). L'echo (le contour du bloc) une seule fois : le reglage touche
 * l'a deja pose s'il est sur l'ecran (touchPage), sinon il est pose ici.
 */
function pageDial(k: number, v: number): void {
  resume();
  const slot = pageSlotOf(k);
  const screen = curScreen();
  const letter = PAGE_KNOB_LETTERS[k] ?? '?';
  const t = slot && slot.label && !slot.graph ? slot.target : null;
  if (!slot || t === null) {
    lcdMessage.show(slot?.graph ? `${slot.label} IS A PICTURE: ${SCREEN_TITLE[screen]}` : `${letter}: EMPTY ON ${SCREEN_TITLE[screen]}`);
    return;
  }
  // Un pas tenu (deux doigts, ou la souris et un potard MIDI, 2026-10-08) : le LOCK passe sur lui des ce potard,
  // meme avant les 350 ms de la tenue
  const lk = rytmLock.get();
  if (editor.get() !== 'mm808' && lk.held.length > 0 && !lk.held.includes(lk.step) && pattern.get().instrument) rytmLockEnter(lk.held[0], false);
  // En P-LOCK (2026-10-08) : le bloc pose le verrou du pas (des pas tenus), jamais la valeur de la voix
  if (lockMode()) {
    lockWrite(k, slot, v);
    return;
  }
  const before = rytmPage.get().echo;
  if (t === 'step:vel') tapVelDial(v);
  else if (t === 'smpl:sample') sampleDial(v);
  else if (t === 'voice:sound') voiceSoundDial(v);
  else if (t === 'voice:mix') voiceMixDial(v);
  else anyDial(t, v);
  // Rien a regler (pas de voix choisie, une voix a un seul son) : le message suffit, pas de contour
  if (!pageKnobLive(k)) return;
  const e = rytmPage.get().echo;
  if (!e || e === before || e.k !== k || e.page !== curScreen()) rytmPage.echo(k, pattern.get().instrument);
}

/**
 * Le potard de page k a-t-il quelque chose a regler maintenant (un bloc
 * vivant) ? Non pour un bloc vide, un dessin, un reglage de voix sans voix
 * choisie, SOUND d'une voix a un seul son hors P-LOCK.
 */
export function pageKnobLive(k: number): boolean {
  return dialValueText(`p:${k}` as DialId) !== '--';
}

/**
 * La course (0 a 1) du potard de page k : celle de ce que son bloc regle,
 * que lisent son jumeau et le MIDI (rytm:knob) ; un bloc qui n'a rien a
 * regler : en bas.
 */
export function pageKnobCourse(k: number): number {
  if (!pageKnobLive(k)) return 0;
  const id = `p:${k}` as DialId;
  const [lo, hi] = dialRange(id);
  return hi > lo ? Math.max(0, Math.min(1, (anyDialValue(id) - lo) / (hi - lo))) : 0;
}

/** La cible d'un potard (un potard de page : celle de son bloc ; null, vide ou un dessin). */
const resolve = (id: DialId): SlotTarget | null => {
  const k = pageKnobOf(id);
  return k < 0 ? id : pageTarget(k);
};

export function anyDial(id: DialId, v: number): void {
  const pk = pageKnobOf(id);
  if (pk >= 0) return pageDial(pk, v);
  const r = kitIdOf(id);
  if (r) return kitDial(r, v);
  const lp = layerIdOf(id);
  if (lp) return layerDial(lp, v);
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
    const inst = pattern.get().instrument;
    // En P-LOCK : la velocite du pas (lockDialValue) ; sinon celle des nouveaux pas
    return inst ? rytmPage.tapVel(inst) : TAP_VEL_DEFAULT;
  }
  if (t === 'smpl:sample') return sampleValue();
  if (t === 'voice:sound') return voiceSoundValue();
  if (t === 'voice:mix') {
    const inst = pattern.get().instrument;
    return inst && soundFamily() ? mixValueOf(kit.playsWith(inst as ShotId, null)) : 0;
  }
  const r = kitIdOf(t);
  if (r) return kit.value(r);
  const lp = layerIdOf(t);
  if (lp) return layerValue(lp);
  const k = voyId(t);
  return k ? voyParams.of(k) : dialValue(t as EncId);
}

export function anyDialReset(id: DialId): number {
  const t = resolve(id);
  if (t === null) return 0;
  // VEL : HIGH, la velocite d'un appui (celle d'avant)
  if (t === 'step:vel') return TAP_VEL_DEFAULT;
  // SMPL SAMPLE : celui du kit de depart (BD, SD : le premier sample de Mika ; les autres OFF)
  if (t === 'smpl:sample') {
    const f = soundFamily();
    const key = f ? KIT_DEFAULT.sample[f] : undefined;
    return f && key ? samplesOf(f).findIndex((x) => x.key === key) + 1 : 0;
  }
  // SOUND : celui du kit de depart (BD, SD : le premier sample de Mika ; les autres leur machine MM)
  if (t === 'voice:sound') {
    const f = soundFamily();
    const inst = pattern.get().instrument;
    if (!f || !inst) return 0;
    const key = KIT_DEFAULT.sample[f];
    const list = voiceSounds(inst);
    const i = key ? list.findIndex((x) => x.kind === 'smp' && x.key === key) : list.findIndex((x) => x.kind === 'mach' && x.key === KIT_DEFAULT.model[f]);
    return Math.max(0, i);
  }
  // MIX : celui du kit de depart (le sample seul pour BD et SD)
  if (t === 'voice:mix') {
    const f = soundFamily();
    return f ? mixOf(KIT_DEFAULT.layer[f].syn, KIT_DEFAULT.layer[f].lev) : 0;
  }
  const r = kitIdOf(t);
  if (r) return kit.def(r);
  const lp = layerIdOf(t);
  if (lp) return layerReset(lp);
  const k = voyId(t);
  return k ? voyParams.def(k) : dialReset(t as EncId);
}

/**
 * Les potards a l'ecran du telephone (2026-10-04, ui/KnobPanel.tsx, Mika :
 * "tous les boutons, beau et accessible, pas tout petit") : la meme saisie
 * que la machine, lue d'un seul identifiant (DialId).
 */

/** La course d'un potard : TEMPO en BPM, TONE et STRETCH de -1 a 1, les autres de 0 a 1 ; VEL de 1 a 9 (0 a 9 en P-LOCK). */
export function dialRange(id: DialId): [number, number] {
  const t = resolve(id);
  if (t === null) return [0, 1];
  const inPage = pageKnobOf(id) >= 0;
  if (t === 'vsound' && inPage && lockMode()) return [0, Math.max(1, lockSoundsOf().length - 1)];
  if (t === 'step:vel') return inPage && lockMode() ? [0, VEL_MAX] : [1, VEL_MAX];
  // SAMPLE en LOCK (R3) : OFF, les samples de la voix, puis ceux des autres voix (le sample lock)
  if (t === 'smpl:sample' && inPage && lockMode()) return [0, Math.max(1, lockSampleList().length - 1)];
  if (t === 'smpl:sample') return [0, Math.max(1, sampleCount())];
  // SOUND (2026-10-09) : sa liste ; en P-LOCK, avec les samples des autres voix
  if (t === 'voice:sound') {
    const inst = pattern.get().instrument;
    return [0, Math.max(1, inst ? voiceSounds(inst, inPage && lockMode()).length - 1 : 1)];
  }
  if (t === 'voice:mix') return [0, 1];
  const lp = layerIdOf(t);
  if (lp) return layerSpan(lp);
  if (kitIdOf(t) || voyId(t)) return [0, 1];
  if (t === 'tempo') return [BPM.min, BPM.max];
  return [potMin(t as EncId), 1];
}

/** Ses crans (0 : continu) : les selecteurs du MM-ARP (pas le morphing de WAVE), les choix de son du kit. */
export function dialSteps(id: DialId): number {
  const t = resolve(id);
  if (t === null) return 0;
  const inPage = pageKnobOf(id) >= 0;
  if (t === 'step:vel') return inPage && lockMode() ? VEL_MAX + 1 : VEL_MAX;
  // SOUND en LOCK (2026-10-08) : les sons de toutes les familles, un cran chacun
  if (t === 'vsound' && inPage && lockMode()) return lockSoundsOf().length;
  // PITCH : au demi-ton, 49 crans (-24 a +24) ; FINE au cent (129) ; le TYPE du filtre (LP HP BP) ; DLY TIME ses divisions
  if (t === 'vtune') return 49;
  if (t === 'vfine') return 129;
  if (t === 'vftype') return 3;
  if (t === 'dtime') return DELAY_DIVS.length;
  if (t === 'smpl:sample' && inPage && lockMode()) return lockSampleList().length;
  if (t === 'smpl:sample') {
    const n = sampleCount();
    return n > 0 ? n + 1 : 0;
  }
  if (t === 'voice:sound') {
    const inst = pattern.get().instrument;
    return inst ? voiceSounds(inst, inPage && lockMode()).length : 0;
  }
  if (t === 'voice:mix') return 0;
  const lp = layerIdOf(t);
  if (lp) return layerNotches(lp);
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
export function dialNudge(id: DialId, n: number, set: (v: number) => void = (v) => anyDial(id, v)): void {
  if (n === 0) return;
  const [lo, hi] = dialRange(id);
  const steps = dialSteps(id);
  const notch = steps > 1 ? (hi - lo) / (steps - 1) : (hi - lo) / 127;
  const v0 = anyDialValue(id);
  for (let m = 1; m <= 8; m += 1) {
    const v = Math.min(hi, Math.max(lo, v0 + n * notch * m));
    set(Math.round(v * 10000) / 10000);
    if (anyDialValue(id) !== v0 || v === lo || v === hi) return;
  }
}

/** Sa valeur lisible (celle des ecrans des machines) ; une voix a choisir d'abord pour la rangee VOICE. */
export function dialReadout(id: DialId): string {
  const pk = pageKnobOf(id);
  if (pk >= 0) {
    const slot = pageSlotOf(pk);
    if (!slot || !slot.label) return 'nothing on this page';
    if (slot.graph) return `${slot.label}, a picture of the ${slot.graph === 'ahd' ? 'envelope' : 'filter'}`;
    const t = slot.target;
    if (t === null) return `${slot.label}, coming soon`;
    // En P-LOCK (2026-10-08) : ce que le pas a, verrouille ou non
    const ls = lockReadStep();
    if (lockMode() && ls >= 0) {
      const lv = pageLockView(pk, ls);
      if (slot.scope === 'all') return `${slot.label}, global, not lockable`;
      if (!slot.lock) return `${slot.label}, not lockable yet`;
      if (lv) return `${slot.label} ${lv.text}${lv.unit ? `, ${lv.unit.toLowerCase()}` : ''}, locked on step ${two(ls + 1)}`;
      return `${slot.label} ${dialValueText(id)}, not locked on step ${two(ls + 1)}`;
    }
    const inst = pattern.get().instrument;
    if (t === 'step:vel') {
      if (!inst) return 'TAP A VOICE';
      const v = rytmPage.tapVel(inst);
      return `VEL ${velTo127(v)}, ${velWord(v).toLowerCase()}, for the new steps of ${inst}`;
    }
    if (t === 'smpl:sample') {
      const txt = sampleText();
      return txt === '--' ? (inst ? 'SAMPLE, no samples for this voice' : 'TAP A VOICE') : `SAMPLE ${txt}, ${sampleUnit().toLowerCase()}`;
    }
    if (t === 'voice:sound' || t === 'voice:mix') {
      if (!inst) return 'TAP A VOICE';
      const p = kit.playsWith(inst as ShotId, null);
      return t === 'voice:sound' ? `SOUND ${voiceSoundText(inst, p)}, ${voiceSoundUnit(inst, p).toLowerCase()}` : `MIX ${mixText(p)}, ${mixUnit(p).toLowerCase()}`;
    }
    return dialReadout(t);
  }
  const r = kitIdOf(id);
  if (r) return kitReadout(r);
  const lp = layerIdOf(id);
  if (lp) {
    const inst = pattern.get().instrument;
    const f = soundFamily();
    if (!inst) return 'TAP A VOICE';
    return f ? layerReadout(lp, inst, f) : `${inst} HAS ONE SOUND`;
  }
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
    const inst = pattern.get().instrument;
    // En P-LOCK (2026-10-08) : la valeur verrouillee du pas, sinon celle de la voix
    const ls = lockReadStep();
    if (ls >= 0 && inst) {
      const lv = pageLockView(pk, ls);
      if (lv) return lv.text;
      // VEL en P-LOCK : le pas lui-meme (vide : OFF)
      if (t === 'step:vel') return 'OFF';
    }
    if (t === 'step:vel') return inst ? String(velTo127(rytmPage.tapVel(inst))) : '--';
    if (t === 'smpl:sample') return sampleText();
    if (t === 'voice:sound') return inst ? (soundFamily() || ls >= 0 ? voiceSoundText(inst, kit.playsWith(inst as ShotId, null)) : '--') : '--';
    if (t === 'voice:mix') return inst && soundFamily() ? mixText(kit.playsWith(inst as ShotId, null)) : '--';
    return dialValueText(t);
  }
  const r = kitIdOf(id);
  if (r) return isFamily(r) || r === 'gate' ? kit.valueText(r) : v127Text(kit.value(r));
  const lp = layerIdOf(id);
  if (lp) return pattern.get().instrument && soundFamily() ? layerText(lp, layerValue(lp)) : '--';
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
  const inst = pattern.get().instrument;
  if (pk >= 0 && ls >= 0 && inst) {
    const lv = pageLockView(pk, ls);
    if (lv) return lv.unit;
    if (t === 'step:vel') return 'EMPTY STEP';
  }
  if (t === 'step:vel') return inst ? `NEW STEPS ${velWord(rytmPage.tapVel(inst))}` : '';
  if (t === 'smpl:sample') return sampleUnit();
  if (t === 'voice:sound') return inst ? voiceSoundUnit(inst, kit.playsWith(inst as ShotId, null)) : '';
  if (t === 'voice:mix') return inst && soundFamily() ? mixUnit(kit.playsWith(inst as ShotId, null)) : '';
  const r = kitIdOf(t);
  if (r) return isFamily(r) ? '' : r === 'gate' ? 'SD + CP' : kitUnit(r);
  const lp = layerIdOf(t);
  if (lp) return inst ? layerUnitNow(lp) : '';
  if (t === 'vsound') {
    // Le choix du son : d'ou il vient (SYNTH 909 / 808 / MM, ou un echantillon) et son rang, comme le bloc de l'ecran
    const f = soundFamily();
    const n = f ? kitSteps(f) : 0;
    const i = f ? kitSoundIndex(f) : 0;
    return n > 0 ? `${i < 3 ? 'SYNTH' : 'SAMPLE'} ${i + 1}/${n}` : '';
  }
  if (voyId(t) || t === 'tempo') return '';
  const e = t as ContEnc;
  if (isVoiceEnc(e) && !inst) return '';
  // DLY TIME : sa duree au tempo du moment
  if (e === 'dtime') return `${Math.round(((60 / pattern.get().bpm / 4) * delayDiv(dialValue(e)).steps) * 1000)} MS`;
  return encUnit(e, dialValue(e));
}

/**
 * EDIT ou le mode presets du MM-RYTM tiennent-ils l'ecran ? Une touche de
 * page les referme (2026-10-08, revue de R1) ; rend true s'il y en avait un.
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
 * sa page s'affiche, sur son onglet retenu ; la touche deja allumee pressee
 * encore (2026-10-09) : l'onglet suivant (VOICE : MAIN puis SYNTH ; FX : VOICE
 * puis GLOBAL), ou HOME pour une page sans onglet (FLTR, ENV ; puis PAGE).
 * Sous EDIT ou les presets, elle les referme et montre sa page. En P-LOCK,
 * jamais HOME (l'ecran reste aux blocs). La touche s'enfonce.
 */
export function rytmPageKey(id: RytmPageId, stage: Stage | null = null): void {
  resume();
  stage?.pressPageKey(id);
  const inst = pattern.get().instrument;
  if (leaveRytmOverlay()) {
    rytmPage.setPage(id);
    lcdMessage.show(`${SCREEN_TITLE[curScreen()]} PAGE`);
    return;
  }
  const lk = rytmLock.get().step;
  if (lk >= 0 && editor.get() !== 'mm808') {
    const tabs = screensOf(id, inst).length;
    if (rytmPage.get().page === id && rytmPage.get().view === 'page' && tabs > 1) rytmPage.press(id, inst);
    else rytmPage.setPage(id);
    lcdMessage.show(`${SCREEN_TITLE[curScreen()]}  P-LOCK ${two(lk + 1)}`);
    return;
  }
  const was = rytmPage.get().view;
  const r = rytmPage.press(id, inst);
  // HOME le dit (et comment revenir) ; un onglet dit le suivant
  if (r.view === 'home') lcdMessage.show(`HOME  ${pageLabel(id)} AGAIN: PAGE`, 1600);
  else if (r.tabs > 1) {
    // SYNTH · VOICE AGAIN: MAIN (revue du 2026-10-09 : VOICE SYNTH  VOICE AGAIN: VOI. au telephone)
    const next = screensOf(id, inst)[(r.tab + 1) % r.tabs];
    lcdMessage.show(`${tabWord(curScreen(), inst)} · ${pageLabel(id)} AGAIN: ${tabWord(next, inst)}`, 1600);
  } else if (was === 'home') lcdMessage.show(`${pageLabel(id)} PAGE`);
}

/**
 * La page d'un FX que tient le bloc k de l'ecran affiche (2026-10-10) : sur
 * GLOBAL FX (DIST CHORUS DELAY REVERB BIT COMP) sa page GLOBAL ; sur VOICE FX
 * (DIST CHORUS DELAY REVERB de la voix) sa page sous la voix (fxvdelay) ; null
 * ailleurs, pour STRETCH et SWING, sur la page d'un FX elle-meme.
 */
export function pageFxDetail(k: number): FxPageId | null {
  const screen = curScreen();
  if (screen !== 'fxg' && screen !== 'fxv') return null;
  const t = pageTarget(k);
  if (!t) return null;
  return screen === 'fxg' ? fxDetailOf(t) : fxVoiceDetailOf(t);
}

/**
 * La page d'un FX (2026-10-10, Mika : "quand je touche a un FX, par exemple
 * DELAY, dans l'ecran, ca doit afficher les configurations que je peux avoir
 * pour DELAY ; pareil pour tous les autres") : une tape sur son bloc de GLOBAL
 * FX (ui/Hotspots.tsx), Entree sur son jumeau, le MIDI rytm:screen:fxdelay ;
 * sous la voix (fxvdelay, Mika : "je veux avoir le choix entre GLOBAL ou
 * VOICE") une tape sur son bloc de VOICE FX, l'onglet de la voix dans
 * l'en-tete, rytm:screen:fxvdelay ; l'onglet GLOBAL y ramene la page de la
 * machine. Le grand bloc cerne un instant, le message dit la page et le retour.
 */
export function rytmFxOpen(p: FxPageId): void {
  const inst = pattern.get().instrument;
  rytmPage.openFx(fxDetailBase(p), inst, isFxVoiceDetail(p));
  rytmPage.echo(0, inst);
  lcdMessage.show(`${tabWord(curScreen(), inst)} · FX: BACK`, 1400);
}

/**
 * Retour a l'onglet de FX du mode (GLOBAL FX ; VOICE FX sous la voix) depuis la
 * page d'un FX (Echap ; la touche FX passe par rytmPage). Seulement quand on la
 * voit : la vue PAGE, ni EDIT ni les presets par-dessus. true si elle s'est refermee.
 */
export function rytmFxClose(): boolean {
  const s = rytmPage.get();
  if (!s.detail || s.view !== 'page' || editor.get() === 'mm808' || presetMode.on('mm808')) return false;
  rytmPage.closeFx();
  lcdMessage.show(SCREEN_TITLE[curScreen()], 900);
  return true;
}

/**
 * Un onglet de l'en-tete de l'ecran touche (2026-10-09) : la page s'affiche sur
 * lui ; la page d'un FX (2026-10-10) s'ouvre, GLOBAL ou sous la voix (ses deux
 * onglets passent de l'une a l'autre).
 */
export function rytmScreenTab(screen: RytmScreenId): void {
  resume();
  if (isFxPage(screen)) {
    rytmFxOpen(screen);
    return;
  }
  const inst = pattern.get().instrument;
  const page = SCREEN_PAGE[screen];
  const i = screensOf(page, inst).indexOf(screen);
  if (i < 0) return;
  rytmPage.setTab(page, i, inst);
  lcdMessage.show(SCREEN_TITLE[screen], 900);
}

/** rytm:page en MIDI : la page (un nom d'avant : la sienne d'aujourd'hui), en vue PAGE ; sous EDIT ou les presets, comme une touche. */
export function rytmShowPage(id: RytmPageId | string): void {
  const page = pageOfAlias(id);
  if (!page) return;
  const left = leaveRytmOverlay();
  // La page d'un FX ouverte (2026-10-10) : rytm:page:fx ramene GLOBAL FX, et le dit
  const same = page === rytmPage.get().page && rytmPage.get().view === 'page' && !rytmPage.get().detail;
  rytmPage.setPage(page);
  if (left || !same) lcdMessage.show(`${SCREEN_TITLE[curScreen()]} PAGE`);
}

/** rytm:home en MIDI (H au clavier, hors EDIT) : HOME, ou la vue PAGE ; sous EDIT ou les presets, les referme sur HOME. */
export function rytmHome(): void {
  if (leaveRytmOverlay()) {
    rytmPage.setView('home');
    return;
  }
  // En LOCK (revue de R2) : l'ecran reste aux blocs (HOME ne montre pas les verrous)
  const lk = rytmLock.get().step;
  if (lk >= 0) {
    lcdMessage.show(`P-LOCK ${two(lk + 1)}: ESC FIRST, THEN HOME`);
    return;
  }
  rytmPage.toggleView();
}

/* ---------------- les verrous du MM-RYTM (2026-10-08, l'etape R2 des P-locks) ---------------- */

/*
 * Mika (2026-10-08) : "quand on clic sur un step on selectionne la partie
 * qu'on veut modifier, est-ce que le voice, est-ce que le FX, est-ce que
 * l'enveloppe, et ensuite on tourne un encoder sur ce step et donc ce step a
 * une valeur differente, et on voit a l'ecran que quand le sequenceur passe
 * sur ce step alors le changement est fait ... MEME CHOSE DANS RYTM". Un pas
 * tenu (ou mis en P-LOCK, state/rytmLock.ts), une page, un bloc de l'ecran
 * (ou un potard MIDI rytm:knob) : le bloc pose son verrou sur ce pas
 * (audio/locks.ts), l'ecran le montre en negatif. Hors de EDIT seulement (ses
 * pas y sont les patterns). Depuis le 2026-10-09 les encodeurs du desktop ne
 * verrouillent plus jamais (les FX globaux) : les verrous se font a l'ecran.
 */

/** Les blocs reglent-ils des verrous (un pas en P-LOCK ou tenu, hors EDIT) ? */
export function lockMode(): boolean {
  return rytmLock.active() && editor.get() !== 'mm808';
}

/** Le pas dont les blocs lisent les verrous : le pas en P-LOCK ; -1 hors P-LOCK. */
export function lockReadStep(): number {
  return lockMode() ? rytmLock.get().step : -1;
}

/** Un son de la liste de SOUND en LOCK (R2, l'ancien SOUND) : le verrou ('<famille>:<son>' ; '' : le son de la voix) et son nom. */
export interface LockSound {
  snd: string;
  label: string;
}

/** Les familles dans l'ordre de la liste (celle de la voix d'abord), et leur nom court. */
const LOCK_FAMS: readonly KitFamily[] = ['bd', 'sd', 'cp', 'hh', 'tom'];
const FAM_TAG: Readonly<Record<KitFamily, string>> = { bd: 'BD', sd: 'SD', cp: 'CP', hh: 'HH', tom: 'TOM', rs: 'RS' };
const lockSoundCache = new Map<string, readonly LockSound[]>();

/**
 * SOUND en LOCK (le "sample lock" d'une Digitakt, R2) : les sons de la famille
 * de la voix d'abord (909, 808, MM, ses echantillons), puis ceux des autres
 * familles ; une voix sans famille (CY) commence par son propre son. Le
 * raccourci vsound (le MIDI rytm:enc:vsound) le garde.
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

const lockSampleCache = new Map<string, readonly LockSound[]>();

/**
 * SMPL SAMPLE en LOCK (R3, le sample lock de l'Analog Rytm) : OFF (la couche
 * SAMPLE muette sur ce pas), les echantillons de la famille de la voix, puis
 * ceux des autres familles ; une voix sans famille (CY) : OFF et ceux de toutes.
 */
export function lockSamples(inst: Inst): readonly LockSound[] {
  let out = lockSampleCache.get(inst);
  if (out) return out;
  const own = familyOf(inst as ShotId);
  const list: LockSound[] = [{ snd: `${own ?? 'bd'}:off`, label: 'OFF' }];
  for (const f of own ? [own, ...LOCK_FAMS.filter((x) => x !== own)] : LOCK_FAMS) {
    for (const x of samplesOf(f)) list.push({ snd: `${f}:${x.key}`, label: f === own ? x.label : `${FAM_TAG[f]} ${x.label}` });
  }
  out = list;
  lockSampleCache.set(inst, out);
  return out;
}
const lockSampleList = (): readonly LockSound[] => {
  const inst = pattern.get().instrument;
  return inst ? lockSamples(inst) : [];
};

/** Le nom d'un verrou pour l'ecran (DEC, SOUND, F.ATK) : le nom court du bloc. */
const lockName = (slot: PageSlot): string => slot.lockName ?? slot.label;

/** Les cles de verrou qu'un bloc ecrit (le son et le melange en ont plusieurs). */
const slotLockKeys = (slot: PageSlot): readonly LockKey[] => (slot.locks ? slot.locks : slot.lock && slot.lock !== 'vel' ? [slot.lock] : []);

/** Le bloc porte-t-il un verrou sur ce pas ? SOUND : son son ou sa machine ; MIX : un de ses niveaux ; les autres : leur cle. */
function slotLocked(slot: PageSlot, l: Readonly<StepLock>): boolean {
  if (slot.target === 'voice:sound') return l.snd !== undefined || l.mach !== undefined;
  if (slot.target === 'voice:mix') return l.syn !== undefined || l.slev !== undefined;
  return !!slot.lock && slot.lock !== 'vel' && l[slot.lock] !== undefined;
}

/**
 * Ce que montre le bloc k pour les verrous du pas `step` de la voix choisie
 * (en P-LOCK, ou le pas qui joue) : sa valeur ecrite, son unite, sa course et
 * sa valeur ; null quand le pas n'a pas de verrou pour ce bloc. VEL : la
 * velocite du pas lui-meme (c'est son verrou), null sur un pas vide.
 */
export function pageLockView(k: number, step: number, lockArg?: Readonly<StepLock> | null): LockView | null {
  const slot = pageSlotOf(k);
  const inst = pattern.get().instrument;
  if (!slot || !inst) return null;
  return slotLockView(slot, inst, step, lockArg);
}

/** Ce qu'un verrou montre : sa valeur ecrite, son unite, sa course et sa valeur. */
export interface LockView {
  text: string;
  unit: string;
  course: number;
  value: number;
}

/** Un verrou du pas, nomme et ecrit (le panneau des verrous de l'ecran, toutes pages, revue de R2). */
export interface LockLine extends LockView {
  page: string;
  name: string;
}

/**
 * Tous les verrous du pas `step` de la voix choisie, ecran apres ecran, avec
 * leur valeur (revue de R2) : un par bloc qui en porte (SOUND, MIX : un seul
 * pour leurs cles) ; VEL n'en est pas un (c'est le pas). Les verrous d'un
 * reglage qui n'est plus sur aucun ecran (S.TUNE, S.START de l'ancien SMPL)
 * suivent, a leur nom : ils jouent encore, CLEAR les efface.
 */
export function lockList(step: number, lockArg?: Readonly<StepLock> | null): LockLine[] {
  const inst = pattern.get().instrument;
  if (!inst || step < 0) return [];
  const l = lockArg === undefined ? lockOf(pattern.get().locks, inst, step) : lockArg;
  if (!l) return [];
  const out: LockLine[] = [];
  const seen = new Set<string>();
  for (const sc of allScreens(inst)) {
    for (const slot of pageSlots(sc, inst)) {
      if (!slot.lock || slot.lock === 'vel' || slot.graph) continue;
      const keys = slotLockKeys(slot);
      if (keys.every((x) => seen.has(x)) || !slotLocked(slot, l)) continue;
      const lv = slotLockView(slot, inst, step, l);
      if (!lv) continue;
      for (const x of keys) seen.add(x);
      out.push({ ...lv, page: pageLabel(SCREEN_PAGE[sc]), name: lockNameOf(slot.lock, inst) ?? lockName(slot) });
    }
  }
  // Les cles sans bloc (les reglages de l'ancien SMPL) : a leur nom, leur valeur brute
  for (const x of LOCK_NAMES) {
    if (seen.has(x.key) || !(x.key in l)) continue;
    const v = (l as Record<string, unknown>)[x.key];
    if (typeof v !== 'number') continue;
    seen.add(x.key);
    const lp = LEGACY_LAYER[x.key];
    out.push({ text: lp ? layerText(lp, v) : v127Text(Math.max(0, Math.min(1, v))), unit: '', course: 0, value: v, page: x.page, name: x.name });
  }
  return out;
}

function slotLockView(slot: PageSlot, inst: Inst, step: number, lockArg?: Readonly<StepLock> | null): LockView | null {
  if (!slot.lock || step < 0) return null;
  if (slot.lock === 'vel') {
    const v = velocity(pattern.get().steps, inst, step);
    if (v === 0) return null;
    // Le pas est deja dans P-LOCK 05 de l'en-tete : son mot seul, HIGH MID LOW ou son gain
    return { text: String(velTo127(v)), unit: velWord(v), course: v / VEL_MAX, value: v };
  }
  const l = lockArg === undefined ? lockOf(pattern.get().locks, inst, step) : lockArg;
  if (!l || !slotLocked(slot, l)) return null;
  // SOUND (2026-10-09) : ce que le pas joue, son rang dans la liste du P-LOCK
  if (slot.target === 'voice:sound') {
    const p = stepPlays(inst, l);
    const list = voiceSounds(inst, true);
    const i = voiceSoundAt(list, p);
    return { text: voiceSoundText(inst, p), unit: voiceSoundUnit(inst, p), course: list.length > 1 ? i / (list.length - 1) : 0, value: i };
  }
  if (slot.target === 'voice:mix') {
    const p = stepPlays(inst, l);
    const m = mixValueOf(p);
    return { text: mixText(p), unit: mixUnit(p), course: m, value: m };
  }
  if (slot.lock === 'mach') {
    if (!l.mach) return null;
    const i = Math.max(0, KIT_MODELS.indexOf(l.mach as KitModel));
    return { text: KIT_MODEL_LABEL[KIT_MODELS[i]], unit: 'SYNTH', course: i / (KIT_MODELS.length - 1), value: i };
  }
  if (slot.lock === 'snd') {
    if (!l.snd) return null;
    if (slot.target === 'smpl:sample') {
      // La couche SAMPLE du pas (R3) : OFF, un sample de la voix, ou d'une autre voix
      const list = lockSamples(inst);
      const i = list.findIndex((x) => x.snd === l.snd);
      const off = parseSnd(l.snd)?.sound === 'off';
      const n = Math.max(1, list.length - 1);
      return { text: off ? 'OFF' : i > 0 ? list[i].label : sndLabel(inst, l.snd), unit: off ? 'NO SAMPLE' : i > 0 ? `${i} OF ${n}` : 'SAMPLE', course: i > 0 ? i / n : 0, value: Math.max(0, i) };
    }
    const label = sndLabel(inst, l.snd);
    const list = lockSounds(inst);
    const i = list.findIndex((x) => x.snd === l.snd);
    const n = Math.max(1, list.length - 1);
    const ps = parseSnd(l.snd);
    const synth = !!ps && (KIT_MODELS as readonly string[]).includes(ps.sound);
    return { text: label, unit: synth ? 'SYNTH' : 'SAMPLE', course: Math.max(0, i) / n, value: Math.max(0, i) };
  }
  const id = slot.lock;
  const v = l[id];
  if (v === undefined) return null;
  // Un reglage de couche (R3) : son nombre et son unite a cette valeur
  const lp = slot.target ? layerIdOf(slot.target) : null;
  if (lp && lp !== 'mach') {
    const [lo, hi] = layerSpan(lp);
    const f = familyOf(inst as ShotId);
    return { text: layerText(lp, v), unit: layerUnit(lp, v, f ? sampleCtx(f, l) : undefined), course: hi > lo ? (v - lo) / (hi - lo) : 0, value: v };
  }
  // Un potard de la machine (revue de R2) : 0 a 127 et son unite a cette valeur (52 HZ, 216 MS) ; GATE ON ou OFF
  const r = slot.target && slot.target !== 'step:vel' && slot.target !== 'smpl:sample' ? kitIdOf(slot.target) : null;
  if (r && !isFamily(r)) {
    if (r === 'gate') return { text: kit.knobText('gate', v), unit: `STEP ${two(step + 1)}`, course: v, value: v };
    return { text: v127Text(v), unit: kitUnitAt(r, v), course: v, value: v };
  }
  const e = slot.target as ContEnc;
  const course = potCourse(e, v);
  return { text: encText(e, v, course, isBipolar(e)), unit: encUnit(e, v), course, value: v };
}

/** Le nom d'un son verrouille, tel que la liste l'ecrit (BLUEPRINT, CP 909). */
function sndLabel(inst: Inst, snd: string): string {
  const hit = lockSounds(inst).find((x) => x.snd === snd);
  if (hit) return hit.label;
  const p = parseSnd(snd);
  return p ? kit.soundName(p.family as KitFamily, p.sound) : snd.toUpperCase();
}

/** La valeur du bloc k en P-LOCK (son domaine : celui du reglage, un rang de liste pour SOUND) ; null : celle de la voix. */
function lockDialValue(k: number): number | null {
  const slot = pageSlotOf(k);
  const step = lockReadStep();
  const inst = pattern.get().instrument;
  if (!slot || !slot.lock || step < 0 || !inst) return null;
  if (slot.lock === 'vel') return velocity(pattern.get().steps, inst, step);
  const l = lockOf(pattern.get().locks, inst, step);
  // SOUND et MIX (2026-10-09) : ce que le pas joue (verrouille ou non : la voix), dans la liste du P-LOCK
  if (slot.target === 'voice:sound') return voiceSoundAt(voiceSounds(inst, true), stepPlays(inst, l));
  if (slot.target === 'voice:mix') return mixValueOf(stepPlays(inst, l));
  if (slot.lock === 'mach') {
    const i = l?.mach ? KIT_MODELS.indexOf(l.mach as KitModel) : -1;
    return i >= 0 ? i : null;
  }
  if (slot.lock === 'snd') {
    if (slot.target === 'smpl:sample') {
      const list = lockSamples(inst);
      const f = familyOf(inst as ShotId);
      const want = l?.snd ?? (f && kit.get().sample[f] ? `${f}:${kit.get().sample[f]}` : '');
      const i = list.findIndex((x) => x.snd === want);
      return l?.snd ? (i >= 0 ? i : null) : Math.max(0, i);
    }
    const list = lockSounds(inst);
    const f = familyOf(inst as ShotId);
    const want = l?.snd ?? (f ? `${f}:${kit.sound(f)}` : '');
    return Math.max(0, list.findIndex((x) => x.snd === want));
  }
  const v = l?.[slot.lock];
  return v === undefined ? null : v;
}

/** Les reglages de l'ancien SMPL sans bloc depuis le 2026-10-09 : leur nombre comme leur page l'ecrivait. */
const LEGACY_LAYER: Readonly<Record<string, LayerDial>> = { stune: 'tune', sfine: 'fine', sstart: 'start' };

/**
 * Le nom court et la page de chaque verrou (dans l'ordre des pages, depuis
 * le 2026-10-09 : VOICE FLTR ENV FX) ; les reglages de l'ancien SMPL qui ne
 * sont plus sur un ecran (S.TUNE, S.FINE, S.START) gardent leur nom.
 */
const LOCK_NAMES: readonly { key: string; name: string; page: string }[] = [
  { key: 'snd', name: 'SOUND', page: 'VOICE' },
  { key: 'level', name: 'VOL', page: 'VOICE' },
  { key: 'tune', name: 'PITCH', page: 'VOICE' },
  { key: 'fine', name: 'FINE', page: 'VOICE' },
  { key: 'slen', name: 'LEN', page: 'VOICE' },
  { key: 'srev', name: 'REV', page: 'VOICE' },
  { key: 'mach', name: 'MACHINE', page: 'VOICE' },
  { key: 'syn', name: 'MIX', page: 'VOICE' },
  { key: 'slev', name: 'MIX', page: 'VOICE' },
  { key: 'ktune', name: 'TUNE', page: 'VOICE' },
  { key: 'sdtune', name: 'TUNE', page: 'VOICE' },
  { key: 'kattack', name: 'ATTACK', page: 'VOICE' },
  { key: 'snappy', name: 'SNAPPY', page: 'VOICE' },
  { key: 'ksweep', name: 'SWEEP', page: 'VOICE' },
  { key: 'sdtone', name: 'TONE', page: 'VOICE' },
  { key: 'kdecay', name: 'DECAY', page: 'VOICE' },
  { key: 'sddecay', name: 'DECAY', page: 'VOICE' },
  { key: 'kdrive', name: 'DRIVE', page: 'VOICE' },
  { key: 'gate', name: 'GATE', page: 'VOICE' },
  { key: 'stune', name: 'S.TUNE', page: 'VOICE' },
  { key: 'sfine', name: 'S.FINE', page: 'VOICE' },
  { key: 'sstart', name: 'S.START', page: 'VOICE' },
  { key: 'fcut', name: 'FREQ', page: 'FLTR' },
  { key: 'freso', name: 'RESO', page: 'FLTR' },
  { key: 'ftype', name: 'TYPE', page: 'FLTR' },
  { key: 'tone', name: 'TONE', page: 'FLTR' },
  { key: 'fatk', name: 'F.ATK', page: 'FLTR' },
  { key: 'fdec', name: 'F.DEC', page: 'FLTR' },
  { key: 'fenv', name: 'F.ENV', page: 'FLTR' },
  { key: 'atk', name: 'ATK', page: 'ENV' },
  { key: 'hold', name: 'HOLD', page: 'ENV' },
  { key: 'decay', name: 'DEC', page: 'ENV' },
  { key: 'start', name: 'START', page: 'ENV' },
  { key: 'pan', name: 'PAN', page: 'ENV' },
  { key: 'dist', name: 'DIST', page: 'FX' },
  { key: 'chorus', name: 'CHORUS', page: 'FX' },
  { key: 'delay', name: 'DELAY', page: 'FX' },
  { key: 'reverb', name: 'REVERB', page: 'FX' },
];

/** Le nom court d'un verrou pour cette voix (le TONE de la caisse claire, le TUNE du kick : ceux de leur machine). */
function lockNameOf(key: string, _inst: Inst): string | undefined {
  return LOCK_NAMES.find((x) => x.key === key)?.name;
}

/** Les verrous du pas en P-LOCK, par leur nom court, toutes pages, dans l'ordre des pages : SOUND VOL DEC (l'ecran et le Dock les listent). */
export function lockSummary(step: number): string[] {
  const inst = pattern.get().instrument;
  const l = inst && step >= 0 ? lockOf(pattern.get().locks, inst, step) : null;
  if (!l || !inst) return [];
  // Une fois chaque nom (MIX pose ses deux niveaux, SOUND sa machine et son sample)
  const names = LOCK_NAMES.filter((x) => x.key in l).map((x) => (x.key === 'mach' && l.snd !== undefined ? 'SOUND' : (lockNameOf(x.key, inst) ?? x.name)));
  return [...new Set(names)];
}

/** Combien de verrous sur ce pas (un par reglage : SOUND et MIX comptent une fois) : le compte de l'en-tete, 3 P-LOCKS. */
export function lockCountOf(step: number): number {
  return lockSummary(step).length;
}

/** Les pages ou le pas a des verrous (VOICE ENV) : le pied de l'ecran les dit quand la liste ne tient pas. */
export function lockPages(step: number): string[] {
  const inst = pattern.get().instrument;
  const l = inst && step >= 0 ? lockOf(pattern.get().locks, inst, step) : null;
  if (!l) return [];
  return [...new Set(LOCK_NAMES.filter((x) => x.key in l).map((x) => x.page))];
}

/** Le domaine de ce qu'un bloc verrouille : un reglage de couche le sien, un potard du kit 0 a 1, un potard de voix le sien. */
function slotDomain(slot: PageSlot): [number, number] {
  const t = slot.target;
  if (!t || t === 'step:vel' || t === 'smpl:sample' || t === 'voice:sound' || t === 'voice:mix') return [0, 1];
  const lp = layerIdOf(t);
  if (lp) return layerSpan(lp);
  if (kitIdOf(t)) return [0, 1];
  return [potMin(t as EncId), 1];
}

/**
 * SOUND verrouille sur des pas (2026-10-09) : le pas joue ce son, avec ce qui
 * a du sens pour lui (le meme raisonnement que hors P-LOCK) : OFF, la voix se
 * tait sur ce pas ; une machine, elle seule (sa couche SAMPLE coupee) ; un
 * sample de la voix, il garde la synthese posee dessous, sinon il joue seul ;
 * un sample d'une autre voix, il joue seul (le sample lock) ; le son de CY :
 * plus de verrou de son.
 */
function soundLockWrite(inst: Inst, steps: readonly number[], at: number, i: number): void {
  const list = voiceSounds(inst, true);
  const s = list[Math.max(0, Math.min(list.length - 1, Math.round(i)))];
  const own = familyOf(inst as ShotId);
  const p = stepPlays(inst, lockOf(pattern.get().locks, inst, at));
  const top = layerTop(p.syn, p.lev);
  if (s.kind === 'own') {
    pattern.clearLock(inst, steps, 'snd');
    pattern.clearLock(inst, steps, 'syn');
    pattern.clearLock(inst, steps, 'slev');
    return;
  }
  if (s.kind === 'off') {
    pattern.setLock(inst, steps, 'snd', `${own ?? 'bd'}:off`);
    pattern.setLock(inst, steps, 'syn', 0);
    pattern.clearLock(inst, steps, 'mach');
    return;
  }
  if (s.kind === 'mach') {
    pattern.setLock(inst, steps, 'mach', s.key);
    pattern.setLock(inst, steps, 'snd', `${own ?? 'bd'}:off`);
    if (p.syn <= 0) pattern.setLock(inst, steps, 'syn', top);
    return;
  }
  pattern.setLock(inst, steps, 'snd', `${s.fam ?? own ?? 'bd'}:${s.key}`);
  pattern.clearLock(inst, steps, 'mach');
  if (s.fam !== own) {
    // Un sample d'une autre voix : il joue seul sur ce pas (audio/kit.ts viewOf), a un niveau qui s'entend
    pattern.clearLock(inst, steps, 'syn');
    if (p.lev <= 0) pattern.setLock(inst, steps, 'slev', top);
    return;
  }
  // Un sample de la voix : avec la synthese dessous si elle y etait (MIX), sinon seul a son niveau
  if (!p.smp) {
    pattern.setLock(inst, steps, 'syn', 0);
    pattern.setLock(inst, steps, 'slev', top);
  }
}

/** MIX verrouille sur des pas (2026-10-09) : les deux niveaux du pas ; sans sample sur ce pas, le premier de la voix vient dessous. */
function mixLockWrite(inst: Inst, steps: readonly number[], at: number, m: number): boolean {
  const own = familyOf(inst as ShotId);
  if (!own || samplesOf(own).length === 0) return false;
  const p = stepPlays(inst, lockOf(pattern.get().locks, inst, at));
  const lv = mixLevels(m, layerTop(p.syn, p.lev));
  pattern.setLock(inst, steps, 'syn', lv.syn);
  pattern.setLock(inst, steps, 'slev', lv.lev);
  if (!p.sample && m > 0) {
    const key = firstSampleOf(own);
    if (key) pattern.setLock(inst, steps, 'snd', `${own}:${key}`);
  }
  return true;
}

/** Le bloc tourne en P-LOCK : son verrou pose sur les pas en P-LOCK ou tenus (ou un message, jamais un geste muet). */
function lockWrite(k: number, slot: PageSlot, v: number): void {
  const inst = pattern.get().instrument;
  const steps = rytmLock.targets();
  if (!inst) {
    lcdMessage.show('TAP A PAD FIRST');
    return;
  }
  if (slot.scope === 'all') {
    lcdMessage.show(`${slot.label} IS GLOBAL: NO P-LOCK`);
    return;
  }
  if (!slot.lock) {
    lcdMessage.show(`${slot.label}: NOT LOCKABLE`);
    return;
  }
  if (steps.length === 0) return;
  // Une voix sans couches (CY, R3) : rien a verrouiller sur MACHINE ni sur les reglages de couche (SOUND, si : un sample lock)
  if (slot.target && layerIdOf(slot.target) && !soundFamily()) {
    lcdMessage.show(`${inst} HAS ONE SOUND: TRY SOUND`);
    return;
  }
  const at0 = rytmLock.get().step >= 0 ? rytmLock.get().step : steps[0];
  if (slot.lock === 'vel') {
    // VEL : la velocite des pas eux-memes (0 les vide, leurs verrous restent)
    const n = Math.max(0, Math.min(VEL_MAX, Math.round(v)));
    for (const i of steps) pattern.set(inst, i, n);
  } else {
    // Un pas vide qu'on verrouille recoit un coup (la velocite des nouveaux pas) : un verrou sans coup ne s'entendrait pas
    for (const i of steps) if (velocity(pattern.get().steps, inst, i) === 0) pattern.set(inst, i, rytmPage.tapVel(inst));
    if (slot.target === 'voice:sound') soundLockWrite(inst, steps, at0, v);
    else if (slot.target === 'voice:mix') {
      if (!mixLockWrite(inst, steps, at0, v)) {
        lcdMessage.show(`${inst}: NO SAMPLES TO MIX`);
        return;
      }
    } else if (slot.lock === 'snd') {
      // L'ancien SAMPLE (le sample lock de R3) : OFF, ceux de la voix, puis ceux des autres voix
      const i = Math.max(0, Math.round(v));
      let snd = '';
      if (slot.target === 'smpl:sample') {
        const list = lockSamples(inst);
        if (list.length < 2) {
          lcdMessage.show('NO SAMPLES IN THE KIT');
          return;
        }
        snd = list[Math.min(list.length - 1, i)].snd;
      } else {
        const list = lockSounds(inst);
        snd = list[Math.min(list.length - 1, i)]?.snd ?? '';
      }
      if (snd) pattern.setLock(inst, steps, 'snd', snd);
      else pattern.clearLock(inst, steps, 'snd');
    } else if (slot.lock === 'mach') {
      // La MACHINE du pas (R3) : 909, 808, MM
      pattern.setLock(inst, steps, 'mach', KIT_MODELS[Math.max(0, Math.min(KIT_MODELS.length - 1, Math.round(v)))]);
    } else {
      const id: LockId = slot.lock;
      // PAN colle au centre, PITCH au demi-ton (comme la valeur de la voix, audio/voicefx.ts) ; le reste a son cran (audio/locks.ts)
      const val = id === 'pan' || id === 'fenv' ? (Math.abs(v) < 0.02 ? 0 : v) : id === 'tune' ? Math.round(v * 24) / 24 : v;
      const [lo, hi] = slotDomain(slot);
      pattern.setLock(inst, steps, id, Math.max(lo, Math.min(hi, val)));
    }
  }
  rytmLock.wrote();
  // Deux doigts (un pas tenu, un bloc tourne) : le P-LOCK s'affiche des le premier verrou
  if (rytmLock.get().step < 0) rytmLock.enter(steps[0], false);
  const at = rytmLock.get().step;
  const lv = pageLockView(k, at);
  const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(at + 1)}`;
  // Une couche muette sur ce pas (R3) : le verrou est pose, il ne s'entendra qu'avec son son (SOUND, MIX), l'ecran le dit
  const silent = slot.layer && !slot.level && layerSilentAt(slot.layer, inst, at) ? `  ${slot.layer === 'synth' ? 'SYNTH' : 'SAMPLE'} OFF HERE` : '';
  lcdMessage.show(lv ? `${who} ${lockName(slot)} ${lv.text}${lv.unit ? `  ${lv.unit}` : ''}${silent}` : `${who} ${lockName(slot)}${silent}`, POT_UI.readoutMs, true);
  rytmPage.echo(k, inst);
}

/** La couche ne joue-t-elle pas sur ce pas (R3) : son niveau a 0 (ou son verrou), la couche SAMPLE sans sample ? */
function layerSilentAt(layer: 'synth' | 'sample', inst: Inst, step: number): boolean {
  const p = stepPlays(inst, lockOf(pattern.get().locks, inst, step));
  return layer === 'synth' ? !p.synth : !p.smp;
}

/**
 * Ce que joue la voix sur un pas (revue de R3, 2026-10-08) : ses deux
 * couches avec les verrous du pas (null : le kit du moment) ; un sample
 * emprunte a une autre famille y joue seul (audio/kit.ts). L'ecran (l'en-tete,
 * les blocs en retrait) et les messages du P-LOCK le lisent.
 */
export function stepPlays(inst: Inst, lock: Readonly<StepLock> | null | undefined): Plays {
  return kit.playsWith(inst as ShotId, lock ? kitOverride(lock) : null);
}

/**
 * Deux tapes sur un bloc (la face, le Dock, l'ecran) : en P-LOCK, son verrou
 * s'en va (le pas reprend la valeur de la voix ; SOUND et MIX : toutes leurs
 * cles) ; sinon, sa valeur de depart.
 */
export function pageKnobReset(k: number): void {
  const id = `p:${k}` as DialId;
  if (!lockMode()) {
    anyDial(id, anyDialReset(id));
    return;
  }
  const slot = pageSlotOf(k);
  const inst = pattern.get().instrument;
  if (!slot || !slot.label || slot.target === null || slot.graph) return;
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
    // VEL : un pas remis a la velocite des nouveaux pas de la voix
    for (const i of steps) pattern.set(inst, i, rytmPage.tapVel(inst));
  } else for (const key of slotLockKeys(slot)) pattern.clearLock(inst, steps, key);
  rytmLock.wrote();
  lcdMessage.show(`STEP ${two(at + 1)} ${lockName(slot)} ${slot.lock === 'vel' ? velWord(rytmPage.tapVel(inst)) : 'UNLOCKED'}`, POT_UI.readoutMs, true);
  rytmPage.echo(k, inst);
}

/**
 * Le P-LOCK sur le pas i (une tenue, L, le MIDI, le Dock) ; latched : il reste
 * au lacher. L'ecran passe a la vue PAGE (HOME ne montre pas les blocs).
 * false s'il n'a pas pu (EDIT, pas de voix).
 */
export function rytmLockEnter(i: number, latched: boolean): boolean {
  if (editor.get() === 'mm808') {
    lcdMessage.show('CLOSE EDIT TO P-LOCK A STEP');
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
  const n = lockCountOf(i);
  lcdMessage.show(`P-LOCK STEP ${two(i + 1)} ${inst}${n > 0 ? `: ${n} P-LOCK${n > 1 ? 'S' : ''}` : ''}`, POT_UI.readoutMs, true);
  return true;
}

/** Une tape sur un pas en P-LOCK : le meme pas en sort, un autre y deplace le P-LOCK. */
export function rytmLockTap(i: number): void {
  const s = rytmLock.get();
  if (s.step === i) {
    rytmLock.leave();
    lcdMessage.show('P-LOCK OFF');
    return;
  }
  rytmLockEnter(i, true);
}

/** L, rytm:lock : le P-LOCK sur ce pas (le pas choisi par defaut), ou hors P-LOCK s'il y est deja. */
export function rytmLockToggle(i: number = rytmPage.get().sel): void {
  const s = rytmLock.get();
  if (s.step >= 0 && (i < 0 || s.step === i)) {
    rytmLock.leave();
    lcdMessage.show('P-LOCK OFF');
    return;
  }
  if (i < 0) {
    lcdMessage.show('HOLD A STEP TO P-LOCK IT');
    return;
  }
  rytmLockEnter(i, true);
}

/** CLEAR en P-LOCK : les verrous des pas en P-LOCK (ou tenus) s'en vont ; leurs coups restent. */
export function rytmLockClear(): void {
  const inst = pattern.get().instrument;
  const steps = rytmLock.targets();
  if (!inst || steps.length === 0) return;
  const had = steps.some((i) => lockOf(pattern.get().locks, inst, i) !== null);
  pattern.clearLock(inst, steps);
  rytmLock.wrote();
  const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(steps[0] + 1)}`;
  lcdMessage.show(had ? `${who} P-LOCKS CLEARED` : `${who} HAS NO P-LOCKS`);
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

