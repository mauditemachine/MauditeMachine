/**
 * Actions partagees (spec 7.2 et 20.6.2) : la couche de saisie, le Dock,
 * le panneau, le clavier et les jumeaux HTML passent tous par ici, pour
 * qu'un objet se comporte pareil d'ou qu'il soit actionne. Ordre d'un coup
 * de pad : le son, puis l'etat (instrument selectionne), puis l'animation.
 * Chaque action relance le contexte audio s'il dort (regle iOS).
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { clock } from './audio/clock';
import { context as audioCtx, cutTails, ensure, kitOverride, mix, resume, setChorus, setDelay, setDrive, setLevel, setReverb, setStretch, setSwing, setVoiceFx, shotReady, trigger } from './audio/drums';
import { TAP_VEL_DEFAULT } from './state/rytmPage';
import { tempoSync } from './state/tempoSync';
import { VOICE_FX_DEFAULT, lfoOf, voiceFx, type VoiceFx, type VoiceParam } from './audio/voicefx';
import { KIT_DEFAULT, KIT_FAMILIES, KIT_LABEL, KIT_MODELS, KIT_MODEL_LABEL, LAYER_DEFAULT, LAYER_PARAMS, familyOf, isFamily, kit, kitSoundIndex, kitSoundNames, kitSteps, layerRange, layerSteps, mixLevels, mixOf, type KitFamily, type KitId, type KitKnob, type KitModel, type Plays } from './audio/kit';
import { isLockTrig, lockOf, parseSnd, type LockId, type LockKey, type Locks, type StepLock } from './audio/locks';
import { TRIG_DEF, TRIG_PARAMS, TRIG_RANGE, isTrigParam, trigText, trigUnit, trigValue, type TrigParam, type TrigRow, type TrigSet } from './audio/trig';
import { LFO_MULTS, LFO_PARAMS, isLfoParam, lfoDefault, lfoParts, lfoRange, lfoText, lfoUnit, type LfoParam } from './audio/lfo';
import { onSampleFailed, onSampleLoaded, requestSample, sampleByKey, sampleLabel, samplePcm, sampleStatus, samplesChanged, samplesOf, samplesVersion, type KitSample, type SampleFail } from './audio/samples';
import { UserSampleError, userSamples } from './audio/usersamples';
import { COLOR_VOICES, randomBeat, randomColors, type BeatStyle } from './audio/beats';
import { BPM, DELAY_DIVS, FX_NOTCHES, INSTRUMENTS, STEP_COUNT, VEL_GAIN, VEL_MAX, VEL_NAMES, delayDiv, fxSnap, isFxSetting, pattern, velocity, type Steps } from './audio/pattern';
import { sc } from './audio/soundcloud';
import { prepareSynth } from './audio/synth';
import type { Stage } from './scene/renderer';
import { bassExplode, chipsLive, explode, voyExplode, type ExplodeStore } from './state/explode';
import { bassInfos } from './state/bassInfos';
import { voyInfos } from './state/voyInfos';
import { rytmInfos } from './state/rytmInfos';
import { voyEcho } from './voyager/echo';
import { voyPatch } from './voyager/patch';
import { BASS, focus, MACHINES, VOYAGER, type Focus, type MachineId } from './state/focus';
import { lcdMessage } from './state/lcdMessage';
import { lcdMix } from './state/lcdMix';
import { BROWSER_ARM_MS, BROWSER_ROWS, lcdSamples } from './state/lcdSamples';
import type { ShotId } from './audio/shotsdsp';
import { contactDraft, type ContactTopic } from './state/contactDraft';
import { editor, type EditorId } from './state/editor';
import { BANKS, bankName, bankOf, patterns, slotName } from './state/patterns';
import { presetMode, type PresetKey } from './state/presetMode';
import { softSlotOf } from './rytm/presetKeys';
import type { FpButtonId } from './rytm/faceplate';
import { undo } from './state/undo';
import { apply, capture, type PresetMachine } from './state/presets';
import { func } from './state/func';
import { dtFace, type MuteView } from './state/dtFace';
import { presskit } from './state/presskit';
import { rytmPage } from './state/rytmPage';
import { rytmLock } from './state/rytmLock';
import { faceTouch, pressVel, type CtlSrc } from './state/ctl';
import { ctlAllState, trk } from './state/trk';
import { fill } from './state/fill';
import { sceneCtl } from './state/sceneCtl';
import { morph } from './audio/morph';
import { NO_SCENES, anyScenes, morph01, sceneCount, type SceneId, type SceneSet } from './rytm/sceneData';
import { bindingOf, from01, sceneRole, to01, voiceRowId, type SceneBinding } from './rytm/sceneParams';
import { FACE_PAGES, RYTM_PAGES, SCREEN_LABEL, SCREEN_PAGE, SCREEN_TITLE, allScreens, faceBlockOf, fxDetailBase, fxDetailOf, fxVoiceDetailOf, isFxPage, isFxVoiceDetail, isRytmPage, pageLabel, pageOfAlias, pageSlots, screensOf, tabWord, type FxPageId, type PageSlot, type RytmPageId, type RytmScreenId, type SlotTarget } from './rytm/pages';
import { encText, encUnit, kitUnit, kitUnitAt, layerText, layerUnit, v127Text, velTo127, velWord, type LayerDial } from './rytm/values';
import { setCtlAllResolver, setKnobResolver, setLiveResolver, setStepResolver } from './rytm/infoIds';
import { section } from './state/section';
import { voices } from './state/voices';
import { bassLoad } from './state/bassload';
import { BOARD_CHIPS, DT_FACE, DT_GESTURE, FACE_FOLLOWS_PAGE, GLOBAL_ENCODERS, SCREEN_TOUCH, LCD_DROP_NO_VOICE, LCD_MUTE_HINT, LCD_NO_VOICE, MOBILE_QUERY, PAD_DOUBLE_TAP_MS, PAGE_KNOB_LETTERS, PORTRAIT, POT_UI, XFADE_UI, isPage, VOICE_PARAM, encLabel, isBipolar, isVoiceEnc, potCourse, potMin, type ChipId, type EncId, type Inst, type PageId, type SectionId } from './theme';
import { arp } from './voyager/arp';
import { CHORDS, PROGRESSIONS } from './voyager/chords';
import { voyMsg } from './voyager/msg';
import { stepIndex, voyKnob, voyParams, voyReadout, voyValueText, type VoyKnobId } from './voyager/params';
import { randomVoyStyle, type VoyStyle } from './voyager/random';
import { SEQ_MAX, seq } from './voyager/seq';

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Premier geste : cree le contexte audio ; ensuite, le relance s'il dort. Le moteur du MM-VOYAGER se charge avec. */
export function gesture(): void {
  ensure();
  resume();
  if (VOYAGER) prepareSynth();
  // Le son du MM-BASS se prepare des le premier geste (2026-10-21, audit) : son premier RUN (MACHINES, Roto) ne
  // l'attend plus ; avec la basse cachee, rien ne se charge
  if (BASS) void bassLoad.load()?.then((m) => m.bassEngine.ensure());
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
    stage?.pressRytmPad(inst);
    return;
  }
  // Mode MUTE : le pad coupe sa voix (ou la rend), sans jouer
  if (voices.get().muteMode) {
    muteVoice(inst);
    stage?.pressRytmPad(inst);
    return;
  }
  // LIVE REC en lecture (V.5.3) : le pad joue sa voix tout de suite et s'ecrit au pas le plus proche (une voix coupee
  // s'ecrit sans un son)
  if (liveRunning()) {
    const n = liveVel();
    if (!voices.isMuted(inst) && !(DT_FACE && pattern.pmuted(inst))) trigger(inst, undefined, false, undefined, VEL_GAIN[n] ?? 1);
    liveHit(inst, n);
    stage?.pressRytmPad(inst);
    funcDrop();
    return;
  }
  // En lecture (2026-10-05, Mika : "quand RYTM est sur RUN, cliquer sur une voix ne doit pas la jouer, juste la
  // selectionner") : la voix est choisie, sans coup ; a l'arret, elle sonne comme avant, a la velocite des nouveaux
  // pas de la voix (VEL de VOICE, 2026-10-09 : HIGH au depart, le coup d'avant). Une voix coupee (2026-10-10, Mika :
  // "quand je clique sur une voix mutee je ne la demute pas, je peux l'editer sans entendre") : choisie, sans un son
  // Le mute du pattern (V.5.0, au desktop seulement : le telephone ne le montre pas) coupe aussi la voix du clavier et du MIDI
  if (!clock.running && !voices.isMuted(inst) && !(DT_FACE && pattern.pmuted(inst))) trigger(inst, undefined, false, undefined, VEL_GAIN[rytmPage.tapVel(inst)] ?? 1);
  selectVoice(inst);
  stage?.pressRytmPad(inst);
  funcDrop();
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
 * Le mute d'une voix au pad (2026-10-10, Mika : "quand je clic droit ou double tap sur mobile je veux muter une
 * voix ; quand je clique sur MUTE ca release tous les mutes ; quand je clique sur une voix mutee je ne la demute
 * pas, je peux l'editer sans entendre, et quand je la demute j'entends la modification") : clic droit (souris) ou
 * double tape (doigt) sur le pad, la voix se coupe ou revient, sans jouer ; elle n'est pas choisie pour autant.
 */
export function padMute(inst: Inst, stage: Stage | null): void {
  gesture();
  voices.toggleMute(inst);
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'ON'}`);
  stage?.pressRytmPad(inst);
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
  // Le navigateur des sons ouvert (2026-10-18) : il passe a la voix touchee (watchBrowser), son repos repart ; l'ecran ne
  // dit pas KNOBS > (la liste montre deja la voix)
  if (lcdSamples.isOpen()) lcdSamples.touch();
  else lcdMessage.show(`KNOBS > ${inst ?? 'PATTERN'}`);
}

/**
 * TRK (2026-10-27, la phase 2, Mika : "comme la DIGITAKT") : l'aide a l'ecran tant que la touche est engagee (tenue,
 * gardee ou en fermeture), eteinte avec elle.
 */
export const TRK_HINT = 'TRK: PICK A VOICE, STEPS 1-8';
/** L'aide de TRK reste tant que la touche est engagee ; elle s'eteint avec elle (une minute au plus : rien ne l'oublie). */
const TRK_HINT_MS = 60000;
/** Le message de TRK a eteindre avec elle ('' : aucun) : l'aide, ou TRK SD tant qu'elle reste tenue. */
let trkLcd = '';
const trkSay = (text: string): void => {
  trkLcd = text;
  lcdMessage.show(text, TRK_HINT_MS);
};

/**
 * TRK + un pas (la face, un jumeau, MIDI rytm:step:i, le RSEQ du Roto) : true quand TRK l'a pris. Les pas 1 a 8 choisissent
 * leur voix (BD SD CH OH CP TOM HT CY, leur legende), les pas 9 a 16 sont reserves : pris, rien ne change, ni lumiere ni
 * message. Ni P-LOCK, ni velocite, ni coup, EDIT ouvert aussi (il reste ouvert dessous).
 */
export function trkStep(i: number, stage: Stage | null = null, t = performance.now()): boolean {
  if (!trk.engaged()) return false;
  // TRK gardee qui se ferme (closing, les 400 ms apres le choix d'une voix ; 2026-10-27, revue B2, deja en ligne depuis le
  // groupe B) : seule la deuxieme tape sur le MEME pas reste a TRK (la double tape coupe la voix) ; tout autre pas ferme
  // TRK et suit son chemin habituel (tape, P-LOCK, EDIT). Avant, chaque tape rapide sur un pas juste apres le choix
  // rechoisissait une voix (et relancait la fenetre) au lieu de programmer la voix choisie. TRK tenue : inchange
  if (trk.get().mode === 'closing' && !(trkLast && trkLast.i === i && t - trkLast.t <= PAD_DOUBLE_TAP_MS)) {
    trk.cancel();
    return false;
  }
  const inst = Number.isInteger(i) && i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst) return true;
  stage?.pressStep(i);
  // Deux tapes sur le meme pas en moins de PAD_DOUBLE_TAP_MS (2026-10-27, la regle des pads du 2026-10-10 passee a TRK) :
  // la voix se coupe ou revient ; hors des modes SOLO et MUTE (leur tape fait deja autre chose)
  const v = voices.get();
  if (!v.soloMode && !v.muteMode && trkLast && trkLast.i === i && t - trkLast.t <= PAD_DOUBLE_TAP_MS) {
    trkLast = null;
    trkMute(inst, t);
    return true;
  }
  trkLast = { i, t };
  trkPick(inst, t);
  return true;
}

/** Le dernier pas choisi par TRK et son heure : la deuxieme tape d'une double tape. */
let trkLast: { i: number; t: number } | null = null;

/**
 * TRK + deux tapes sur un pas 1 a 8, ou TRK + un clic droit sur lui (2026-10-27) : sa voix se coupe ou revient, sans un son
 * et sans la choisir (padMute) ; TRK s'en est servi.
 */
export function trkMute(inst: Inst, t = performance.now()): void {
  ctlAllEnd();
  padMute(inst, null);
  trk.use(t);
}

/** Le clic droit sur un pas pendant TRK (ui/Hotspots.tsx) : 1 a 8 coupent leur voix ; true quand TRK l'a pris. */
export function trkStepMute(i: number, stage: Stage | null = null, t = performance.now()): boolean {
  if (!trk.engaged()) return false;
  const inst = Number.isInteger(i) && i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst) return true;
  stage?.pressStep(i);
  trkLast = null;
  trkMute(inst, t);
  return true;
}

/**
 * Le choix de TRK, dans l'ordre de padHit : mode SOLO, la voix en solo ; mode MUTE, coupee ; sinon la voix choisie, sans
 * un son (la Digitakt), jamais deselectionnee ; l'ecran dit TRK SD. TRK s'en est servi : gardee, elle se ferme.
 */
export function trkPick(inst: Inst, t: number): void {
  // Le choix d'une voix termine un CONTROL ALL (V.5.2, la revue de D3a, R4)
  ctlAllEnd();
  resume();
  const v = voices.get();
  if (v.soloMode) soloVoice(inst);
  else if (v.muteMode) muteVoice(inst);
  else {
    if (pattern.get().instrument !== inst) pattern.select(inst);
  }
  trk.use(t);
  if (v.soloMode || v.muteMode) return;
  // Le navigateur des sons ouvert : il passe a la voix choisie (watchBrowser), son repos repart. TRK tenue : TRK SD reste
  // jusqu'au lacher ; gardee, elle se ferme : le message ordinaire
  if (lcdSamples.isOpen()) lcdSamples.touch();
  else if (trk.get().mode === 'held') trkSay(`TRK ${inst}`);
  else lcdMessage.show(`TRK ${inst}`);
}

/**
 * TRK enfonce (src : 'ptr:<pointerId>', 'key', 'at', 'midi', 'hw') ; l'ecran dit quoi faire tant qu'elle est engagee. Au
 * desktop depuis V.5.0 : FUNC + TRK, le mode MUTE (muteModeKey), son lacher est alors avale ; TRK seule ferme le mode MUTE.
 */
export const trkDown = (src: string, t = performance.now()): void => {
  if (DT_FACE && funcTake()) {
    trkTaken.add(src);
    muteModeKey();
    return;
  }
  // TRK gagne sur le mode MUTE (la revue de D1, R5) : il se ferme, la face, le boitier et le geste montrent TRK
  if (DT_FACE && dtFace.mute() !== 'off' && !trk.engaged()) dtFace.setMute('off');
  const was = trk.engaged();
  trk.down(src, t);
  if (!was && trk.engaged()) trkSay(TRK_HINT);
};
/** Les appuis de TRK pris par FUNC (V.5.0) : leur lacher ne fait rien. */
const trkTaken = new Set<string>();
/** TRK lachee ; t < 0 : un pointeur perdu (lache sans garde). */
export const trkUp = (src: string, t = performance.now()): void => {
  if (trkTaken.delete(src)) return;
  trk.up(src, t);
};
// TRK eteinte (lachee, fermee, Echap, une autre machine) : son aide s'en va avec elle ; CONTROL ALL est fait (V.5.2)
trk.subscribe(() => {
  if (trk.engaged()) return;
  ctlAllEnd();
  // Eteinte : la double tape repart de zero a la prochaine
  trkLast = null;
  if (!trkLcd) return;
  lcdMessage.hide(trkLcd);
  trkLcd = '';
});

/** Phase 3 (rytm:voice:select:<V>, le materiel) : le meme choix muet, sans TRK. */
export function voiceSelect(inst: Inst, src: CtlSrc = 'ui'): void {
  void src;
  resume();
  if (pattern.get().instrument !== inst) pattern.select(inst);
  if (lcdSamples.isOpen()) lcdSamples.touch();
  else lcdMessage.show(`TRK ${inst}`);
}

/* ---------------- SCENE A et B : tenir ou taper, puis tourner (2026-10-27, la phase 2) ---------------- */

/*
 * Facon Octatrack et Digitakt (Mika : "SCENE A, la fente du crossfader, SCENE B") : une touche SCENE tenue enregistre
 * tant qu'on la tient, une tape la garde (une autre tape, Echap, CLEAR de la scene ou une autre machine la rendent) ;
 * pendant ce temps chaque potard, bloc, jumeau ou cible MIDI du MM-RYTM qui se morphe ecrit dans la scene armee, jamais
 * dans la base (pattern.scenes, une etape d'UNDO par geste). Un pas tenu gagne (le P-LOCK) ; TEMPO, MASTER, les mutes, RUN
 * et les pages passent toujours a la base ; un choix de son dit NO SCENE. Armer une scene quitte un P-LOCK garde ; garder
 * le P-LOCK (un pas tenu lache sans tourner) desarme une scene gardee : jamais les deux.
 */
const SCENE_WORD: Readonly<Record<SceneId, string>> = { a: 'SCENE A', b: 'SCENE B' };
const SCENE_SHORT: Readonly<Record<SceneId, string>> = { a: 'SCN A', b: 'SCN B' };
/** La scene armee (tenue ou gardee), null : aucune. */
export const sceneArmed = (): SceneId | null => sceneCtl.get().armed;

/** SCENE A ou B enfoncee (src : 'ptr:<pointerId>', 'key', 'at', 'midi', 'hw') : armee ; l'ecran dit ce qu'elle a. */
export function sceneDown(w: SceneId, src: string, t = performance.now()): void {
  resume();
  // FUNC n'a pas de sens sur SCENE A et B (la revue de D1, G2) : la scene s'arme, FUNC s'en va
  funcDrop();
  // Jamais un P-LOCK garde et une scene armee ensemble (un pas tenu, lui, gagne : rien ne change)
  if (rytmLock.get().latched) rytmLock.leave();
  const was = sceneCtl.get().armed;
  sceneCtl.armDown(w, src, t);
  const now = sceneCtl.get().armed;
  if (now !== w || was === w) return;
  const n = sceneCount(pattern.scenes.get(), w);
  lcdMessage.show(n === 0 ? `${SCENE_WORD[w]}: TURN A KNOB` : `${SCENE_WORD[w]}: ${n} PARAM${n > 1 ? 'S' : ''}`);
}
/** SCENE A ou B lachee ; t < 0 : un pointeur perdu (lache sans garde). */
export function sceneUp(w: SceneId, src: string, t = performance.now()): void {
  sceneCtl.armUp(w, src, t);
}
// Le P-LOCK garde (un pas tenu lache sans tourner, L, le MIDI) : une scene armee se desarme, gardee ou tenue (2026-10-27,
// revue B3 : une scene tenue restait armee a cote du P-LOCK garde, un cran de molette ecrivait 8 valeurs dans la scene ;
// le lacher de la touche tenue est ensuite ignore, holdLatch eteinte)
rytmLock.subscribe(() => {
  const lk = rytmLock.get();
  if (lk.step >= 0 && lk.latched && sceneCtl.get().armed) sceneCtl.cancel();
});

/**
 * L'id absolu de ce que regle un potard (le registre MIDI, la cle d'une scene) : un potard de page, celui de son bloc ;
 * la rangee de la voix, la voix choisie (rytm:voice:SD:decay) ; r:<potard> rytm:kit:<potard> ; l:<reglage> la couche de
 * la voix choisie ; un encodeur rytm:enc:<id>. null : rien (une case vide, un dessin, VEL, SOUND, MIX, SAMPLE, le MM-ARP).
 */
export function sceneIdOfDial(dial: DialId): string | null {
  const pk = pageKnobOf(dial);
  const t = pk >= 0 ? pageTarget(pk) : dial;
  if (t === null || t === 'step:vel' || t === 'smpl:sample' || t === 'voice:sound' || t === 'voice:mix') return null;
  const r = kitIdOf(t as DialId);
  if (r) return `rytm:kit:${r}`;
  const lp = layerIdOf(t);
  if (lp) {
    const f = soundFamily();
    return f ? `rytm:layer:${f}:${lp}` : null;
  }
  if (voyId(t as DialId)) return null;
  const mi = mixerInst(t);
  if (mi) return `rytm:voice:${mi}:level`;
  // Un reglage de trig ou d'un LFO (V.5.1) : sa cible de voix (hors des scenes en D2, rytm/sceneParams.ts : noscene)
  const sd = seqDialOf(t);
  if (sd) {
    const inst = pattern.get().instrument;
    return inst ? `rytm:voice:${inst}:${sd}` : null;
  }
  const e = t as EncId;
  if (e === 'vsound') return 'rytm:enc:vsound';
  if (isVoiceEnc(e)) return voiceRowId(e, pattern.get().instrument);
  return `rytm:enc:${e}`;
}

/** La valeur 0 a 1 de id dans la scene armee ; null : pas armee, ou id n'y est pas. */
export function sceneEdit01(id: string): number | null {
  const w = sceneCtl.get().armed;
  if (!w) return null;
  const v = pattern.scenes.get()[w][id];
  return v === undefined ? null : v;
}

/** Ce que montre la scene pour un potard, en unites du potard ; null : la base. */
function sceneNative(dial: DialId, played: boolean): number | null {
  // Ni armee ni scene dans le motif : la base, sans rien chercher (le chemin de toujours)
  if (!sceneCtl.get().armed && (!played || pattern.scenes.get() === NO_SCENES)) return null;
  const id = sceneIdOfDial(dial);
  if (!id) return null;
  const b = bindingOf(id);
  if (!b) return null;
  if (sceneCtl.get().armed) {
    const v = sceneEdit01(id);
    return v === null ? null : from01(b, v);
  }
  if (!played) return null;
  const p = morph.played01(id);
  return p === null ? null : from01(b, p);
}

/**
 * D'ou part un glisser, une molette, un jumeau ou un get() MIDI : armee, la valeur de la scene (la base pour un reglage
 * pas encore dans la scene, le premier cran cree la cle) ; en P-LOCK, le verrou ; sinon ce qu'on entend (2026-10-28 :
 * la base, ou ce qu'une scene en fait entendre, sceneFollow), la ou se tient le potard.
 */
export function dialEdit(id: DialId): number {
  // Un pas tenu gagne (le P-LOCK, meme avant les 350 ms de la tenue) : le geste part de ce que le verrou ecrira
  if (pageKnobOf(id) >= 0 && (lockMode() || rytmLock.get().held.length > 0)) return anyDialValue(id);
  if (!sceneCtl.get().armed) {
    const h = heardOf(id);
    return h ? from01(h.b, h.p) : anyDialValue(id);
  }
  return sceneNative(id, false) ?? anyDialValue(id);
}

/** Un reglage qu'une scene fait entendre hors scene armee : son id, sa loi, la base et ce qui joue en 0 a 1, et x. */
interface Heard {
  id: string;
  b: SceneBinding;
  base01: number;
  a: number | undefined;
  bv: number | undefined;
  x: number;
  p: number;
}

/**
 * Ce qu'on entend d'un reglage hors scene armee (2026-10-28) : LA formule (morph01) depuis la base du potard ; null :
 * aucune scene ne le tient (la base, le chemin de toujours), une scene armee, un pas tenu ou le LOCK (le P-LOCK gagne),
 * le MM-ARP.
 */
function heardOf(dial: DialId): Heard | null {
  if (sceneCtl.get().armed || voyId(dial)) return null;
  if (pattern.scenes.get() === NO_SCENES) return null;
  if (pageKnobOf(dial) >= 0 && (lockMode() || rytmLock.get().held.length > 0)) return null;
  const id = sceneIdOfDial(dial);
  if (!id) return null;
  const b = bindingOf(id);
  return b ? heardId(id, b, to01(b, anyDialValue(dial))) : null;
}

/** La meme chose pour un id absolu et sa base en 0 a 1 (les cibles MIDI des voix). */
function heardId(id: string, b: SceneBinding, base01: number): Heard | null {
  if (sceneCtl.get().armed || sceneRole(id) !== 'sceneable') return null;
  const s = pattern.scenes.get();
  const a = s.a[id];
  const bv = s.b[id];
  if (a === undefined && bv === undefined) return null;
  const x = sceneCtl.x();
  return { id, b, base01, a, bv, x, p: morph01(a, bv, base01, x) };
}

/** Ce qu'une cible MIDI fait entendre hors scene armee, en 0 a 1 ; null : sa base (aucune scene ne la tient). */
export function sceneHeard01(id: string, base01: number): number | null {
  const b = bindingOf(id);
  const h = b ? heardId(id, b, base01) : null;
  return h ? h.p : null;
}

let following = false;
/**
 * Un potard tourne hors scene armee sur un reglage qu'une scene fait entendre (2026-10-28, Mika : "je peux meme plus
 * tourner les knobs" : la scene A au repos du crossfader tenait DIST, CHORUS, REVERB et COMP, la main ne changeait que
 * leur base, muette, le potard restait fige) : ce qu'on entend suit la main, au x du moment. Chaque valeur qui y prend
 * part se decale du meme ecart (la scene A si elle le tient et s'entend, x < 1 ; la B de meme, x > 0 ; la base si elle
 * s'entend encore) : le morphing garde sa forme, le potard tourne sans saut. writeBase : la base, par le chemin de
 * toujours, une seule fois (following). true : fait ; false : rien a suivre (la suite comme avant).
 */
function follow(h: Heard, t01: number, writeBase: (v01: number) => void, say: (scn: string) => void): boolean {
  const useA = h.a !== undefined && h.x < 1;
  const useB = h.bv !== undefined && h.x > 0;
  if (!useA && !useB) return false;
  const d = t01 - h.p;
  if (d !== 0) {
    // Les poids de LA formule : A 1 - x, B x, la base (A absent ? 1 - x : 0) + (B absent ? x : 0) ; leur somme vaut 1
    const wBase = (h.a === undefined ? 1 - h.x : 0) + (h.bv === undefined ? h.x : 0);
    const v = [useA ? (h.a as number) : 0, useB ? (h.bv as number) : 0, h.base01];
    const w = [useA ? 1 - h.x : 0, useB ? h.x : 0, wBase];
    const free = [w[0] > 0, w[1] > 0, w[2] > 0];
    // Le meme ecart pour chacune ; une valeur a sa butee laisse le reste aux autres (revue du 2026-10-28 : la main va au
    // bout de sa course au milieu du crossfader aussi)
    let rest = d;
    for (let it = 0; it < 3 && Math.abs(rest) > 1e-9; it += 1) {
      const wf = (free[0] ? w[0] : 0) + (free[1] ? w[1] : 0) + (free[2] ? w[2] : 0);
      if (wf <= 0) break;
      const step = rest / wf;
      rest = 0;
      for (let i = 0; i < 3; i += 1) {
        if (!free[i]) continue;
        const want = v[i] + step;
        const got = Math.max(0, Math.min(1, want));
        if (got !== want) free[i] = false;
        rest += (want - got) * w[i];
        v[i] = got;
      }
    }
    if (useA) pattern.scenes.write('a', h.id, v[0]);
    if (useB) pattern.scenes.write('b', h.id, v[1]);
    if (wBase > 0) {
      following = true;
      try {
        writeBase(v[2]);
      } finally {
        following = false;
      }
    }
  }
  say(useA && useB ? 'SCN A+B' : useA ? SCENE_SHORT.a : SCENE_SHORT.b);
  return true;
}

/** Un potard d'interface (anyDial, le bloc d'une page, un encodeur global) : sceneFollow, vNative en unites du potard. */
function sceneFollow(dial: DialId, vNative: number): boolean {
  if (following) return false;
  const h = heardOf(dial);
  if (!h) return false;
  return follow(
    h,
    to01(h.b, vNative),
    (v01) => anyDial(dial, from01(h.b, v01)),
    (scn) => {
      lcdMessage.show(`${scn} ${dialName(dial)} ${dialValueText(dial)}`, POT_UI.readoutMs, true);
      const pk = pageKnobOf(dial);
      if (pk >= 0 && pageKnobLive(pk)) rytmPage.echo(pk, pattern.get().instrument);
    },
  );
}

/** Une cible MIDI d'une voix (rytm:voice:<inst>:<p>), v01 et sa base en 0 a 1 ; writeBase pose la base. */
export function sceneFollowId(id: string, v01: number, base01: number, writeBase: (v01: number) => void): boolean {
  if (following) return false;
  const b = bindingOf(id);
  const h = b ? heardId(id, b, base01) : null;
  if (!h || !b) return false;
  return follow(h, Math.max(0, Math.min(1, v01)), writeBase, (scn) => lcdMessage.show(`${scn} ${idName(id)} ${v127Text(morph.played01(id) ?? v01, b.lo < 0)}`, POT_UI.readoutMs, true));
}

/** Ce qui se montre (les blocs, les valeurs, les anneaux) : armee la scene ; en P-LOCK le verrou ; sinon ce qui joue. */
export function dialShown(id: DialId): number {
  if (pageKnobOf(id) >= 0 && lockMode()) return anyDialValue(id);
  return sceneNative(id, true) ?? anyDialValue(id);
}

/** Le nom d'un potard pour l'ecran (le bloc, l'encodeur, la cible). */
function dialName(dial: DialId): string {
  const pk = pageKnobOf(dial);
  if (pk >= 0) return pageSlotOf(pk)?.label ?? PAGE_KNOB_LETTERS[pk] ?? '?';
  const r = kitIdOf(dial);
  if (r) return KIT_LABEL[r] ?? r.toUpperCase();
  const lp = layerIdOf(dial);
  if (lp) return lp.toUpperCase();
  const mi = mixerInst(dial);
  if (mi) return `${mi} VOL`;
  const sd = seqDialOf(dial);
  if (sd) return seqName(sd);
  return encLabel(dial as EncId);
}
/** Le nom d'une cible absolue (rytm:voice:CH:pan -> CH PAN). */
function idName(id: string): string {
  const p = id.split(':');
  if (p[1] === 'enc') return encLabel(p[2] as EncId);
  if (p[1] === 'voice') return `${p[2]} ${p[3].toUpperCase()}`;
  return p.slice(2).join(' ').toUpperCase();
}

/**
 * LE point de passage des potards d'interface (2026-10-27, 10.2 de la spec) : true quand la scene armee a pris le geste
 * (la base n'est pas touchee), false : la suite comme avant. Hors scene armee (2026-10-28) : sceneFollow, un reglage
 * qu'une scene fait entendre suit la main ; sinon false. Ni le MM-ARP, ni TEMPO et MASTER, ni un potard de page sous un
 * pas tenu (le P-LOCK gagne) : false. Un choix de son ou un reglage lourd (avant P2-22) : NO SCENE, rien
 * d'ecrit, true. vNative : en unites du potard.
 */
export function sceneTake(dial: DialId, vNative: number): boolean {
  const w = sceneCtl.get().armed;
  // Hors scene armee (2026-10-28) : un reglage qu'une scene fait entendre suit la main (sceneFollow), le reste comme avant
  if (!w) return sceneFollow(dial, vNative);
  if (voyId(dial)) return false;
  const pk = pageKnobOf(dial);
  if (pk >= 0 && rytmLock.get().held.length > 0) return false;
  const t = pk >= 0 ? pageTarget(pk) : dial;
  if (t === null) return false;
  if (t === 'tempo' || t === 'level') return false;
  const id = sceneIdOfDial(dial);
  if (!id) {
    // Une voix a choisir d'abord (la rangee de la voix, VOL, SOUND sans voix) ; sinon un choix de son
    if (!pattern.get().instrument && (t === 'voice:sound' || t === 'voice:mix' || t === 'smpl:sample' || t === 'step:vel' || isVoiceEnc(t as EncId))) lcdMessage.show(LCD_NO_VOICE);
    else lcdMessage.show(`${dialName(dial)}: NO SCENE`);
    return true;
  }
  const b = bindingOf(id);
  if (sceneRole(id) !== 'sceneable' || !b) {
    if (sceneRole(id) === 'passthrough') return false;
    lcdMessage.show(`${dialName(dial)}: NO SCENE`);
    return true;
  }
  if (!writeScene(w, id, to01(b, vNative))) return true;
  lcdMessage.show(`${SCENE_SHORT[w]} ${dialName(dial)} ${dialValueText(dial)}`, POT_UI.readoutMs, true);
  if (pk >= 0 && pageKnobLive(pk)) rytmPage.echo(pk, pattern.get().instrument);
  return true;
}

/** La meme chose pour une cible du registre (l'id absolu, 0 a 1) : rytm:voice, rytm:kit, rytm:layer, rytm:enc. */
export function sceneTakeId(id: string, v01: number): boolean {
  const w = sceneCtl.get().armed;
  if (!w) return false;
  const role = sceneRole(id);
  if (role === 'passthrough') return false;
  const b = bindingOf(id);
  if (role !== 'sceneable' || !b) {
    lcdMessage.show(`${idName(id)}: NO SCENE`);
    return true;
  }
  if (!writeScene(w, id, Math.max(0, Math.min(1, v01)))) return true;
  lcdMessage.show(`${SCENE_SHORT[w]} ${idName(id)} ${v127Text(v01, b.lo < 0)}`, POT_UI.readoutMs, true);
  return true;
}

/** L'ecriture dans la scene armee ; false : pleine (64 valeurs, l'ecran le dit). */
function writeScene(w: SceneId, id: string, v01: number): boolean {
  if (pattern.scenes.write(w, id, v01) === 'full') {
    lcdMessage.show(`${SCENE_WORD[w]} FULL`);
    return false;
  }
  sceneCtl.use(performance.now());
  return true;
}

/**
 * La base d'un potard ne s'entend plus au x du moment (2026-10-27, revue B1) : son poids dans LA formule,
 * (A absent ? 1 - x : 0) + (B absent ? x : 0), vaut 0. 'AB' : les deux scenes l'ont ; 'A' : A seule a x = 0 (la
 * position d'arrivee) ; 'B' : B seule a x = 1 ; null : la base s'entend (en partie au moins), ou rien n'est morphe.
 */
function sceneHides(dial: DialId): 'A' | 'B' | 'AB' | null {
  if (sceneCtl.get().armed) return null;
  const s = pattern.scenes.get();
  if (s === NO_SCENES) return null;
  const id = sceneIdOfDial(dial);
  if (!id) return null;
  const inA = s.a[id] !== undefined;
  const inB = s.b[id] !== undefined;
  if (inA && inB) return 'AB';
  const x = sceneCtl.x();
  if (inA && x <= 0) return 'A';
  if (inB && x >= 1) return 'B';
  return null;
}
/** Le telephone n'a ni touche SCENE ni crossfader avant la phase 5 (revue BEH-2) : il dit seulement quelle scene joue. */
const phoneFace = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_QUERY).matches;
const hideText = (dial: DialId, h: 'A' | 'B' | 'AB'): string =>
  phoneFace()
    ? `${dialName(dial)}: SCENE ${h === 'AB' ? 'A+B' : h} PLAYS`
    : h === 'AB'
      ? `${dialName(dial)}: IN SCENES A+B, HOLD A SCENE`
      : `${dialName(dial)}: SCENE ${h} PLAYS, HOLD SCENE ${h}`;

/**
 * Tourne hors scene sur un reglage que la scene entendue tient entierement (10.2, Feel ; les deux scenes, ou depuis la
 * revue B1 du 2026-10-27 A seule a x = 0 et B seule a x = 1) : la base change mais rien ne s'entend ; l'ecran le dit,
 * une fois toutes les 2 s au plus.
 */
let hintAt = -Infinity;
const SCENE_HINT_MS = 2000;
function sceneHint(dial: DialId): void {
  const h = sceneHides(dial);
  if (!h) return;
  const now = performance.now();
  if (now - hintAt < SCENE_HINT_MS) return;
  hintAt = now;
  lcdMessage.show(hideText(dial, h));
}

/**
 * Le message d'un potard tourne hors scene (2026-10-27, revue B1) : sa base ne s'entend pas, l'ecran dit pourquoi a la
 * place de la valeur de base (le bloc et l'anneau montrent ce qui joue, le message ne les contredit plus) ; true : dit.
 */
function sceneHideSay(dial: DialId): boolean {
  const h = sceneHides(dial);
  if (!h) return false;
  hintAt = performance.now();
  lcdMessage.show(hideText(dial, h));
  return true;
}

/** Le coin d'un reglage morphe pour une lecture (les jumeaux, 2026-10-27, revue B1) : comme le coin du bloc. */
function sceneMark(dial: DialId): string {
  const s = pattern.scenes.get();
  if (s === NO_SCENES) return '';
  const id = sceneIdOfDial(dial);
  if (!id) return '';
  const inA = s.a[id] !== undefined;
  const inB = s.b[id] !== undefined;
  return inA && inB ? ', scenes A and B' : inA ? ', scene A' : inB ? ', scene B' : '';
}

/** Deux tapes ou Suppr sur un potard pendant qu'une scene est armee : sa cle s'en va (sa propre etape d'UNDO). */
function sceneDrop(dial: DialId): boolean {
  const w = sceneCtl.get().armed;
  if (!w) return false;
  const id = sceneIdOfDial(dial);
  if (!id || pattern.scenes.get()[w][id] === undefined) return false;
  undo.boundary('mm808', 'step');
  pattern.scenes.drop(w, id);
  sceneCtl.use(performance.now());
  lcdMessage.show(`${SCENE_SHORT[w]} ${dialName(dial)} REMOVED`);
  return true;
}

/* ---------------- le crossfader (2026-10-27, P2-20, Mika : "SCENE A, la fente du crossfader, SCENE B") ---------------- */

/*
 * De la scene A (x 0) a la scene B (x 1), comme sur un Octatrack : le glisser 3D du capuchon (relatif, jamais un saut), la
 * molette au-dessus de la fente, son jumeau (un curseur natif) et, en phase 3, le MIDI. Rien ne s'ecrit (ni store, ni
 * UNDO, ni le navigateur) : x vit dans state/sceneCtl.ts, le morphing (audio/morph.ts) fait entendre ce qu'il faut.
 * L'ecran dit XFADE A 70 · B 30 au plus toutes les 120 ms ; des scenes vides, une fois par visite, comment les remplir.
 */
let xfReadAt = -Infinity;
let xfReadTimer = 0;
let xfHinted = false;

/** La ligne de l'ecran : ce qu'on entend de A et de B, en pour cent. */
function xfadeReadout(): void {
  const x = sceneCtl.x();
  xfReadAt = performance.now();
  lcdMessage.show(`XFADE A ${Math.round((1 - x) * 100)} · B ${Math.round(x * 100)}`, POT_UI.readoutMs, true);
}

/** Le crossfader, de 0 (A) a 1 (B). */
export const xfadeValue = (): number => sceneCtl.x();

/** Le crossfader a x (borne a 0..1) ; src : qui le pousse (ptr, wheel, twin, midi). */
export function xfadeSet(x: number, src: CtlSrc): void {
  resume();
  const was = sceneCtl.x();
  sceneCtl.setX(x, src);
  if (sceneCtl.x() === was) return;
  if (!anyScenes(pattern.scenes.get()) && !xfHinted) {
    xfHinted = true;
    lcdMessage.show('SCENES EMPTY: HOLD SCENE A OR B AND TURN A KNOB');
    return;
  }
  const left = xfReadAt + XFADE_UI.readoutMs - performance.now();
  if (left <= 0) {
    window.clearTimeout(xfReadTimer);
    xfReadTimer = 0;
    xfadeReadout();
  } else if (!xfReadTimer)
    xfReadTimer = window.setTimeout(() => {
      xfReadTimer = 0;
      xfadeReadout();
    }, left);
}

/** Le debut et la fin d'un geste du crossfader (la fin : x au repos, la forme de la REVERB et les coups s'y recalent). */
export function xfadeGesture(phase: 'start' | 'end', src: CtlSrc): void {
  sceneCtl.gesture(phase === 'start', src);
}

/**
 * La bande du crossfader d'un potard de page (P2-20) : ses deux bouts, A puis B, sur la course du potard ; false : son
 * reglage ne se morphe pas, ou le P-LOCK montre un verrou. out est rempli sur place.
 */
const bandEnds: [number, number] = [0, 0];
export function pageKnobBand(k: number, out: [number, number]): boolean {
  if (pattern.scenes.get() === NO_SCENES || lockMode()) return false;
  const id = `p:${k}` as DialId;
  const sid = sceneIdOfDial(id);
  const b = sid ? bindingOf(sid) : null;
  if (!sid || !b || !morph.ends01(sid, bandEnds)) return false;
  const [lo, hi] = dialRange(id);
  if (!(hi > lo)) return false;
  for (let i = 0; i < 2; i += 1) out[i] = Math.max(0, Math.min(1, (from01(b, bandEnds[i]) - lo) / (hi - lo)));
  return true;
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
  stage?.pressRytmPad(id);
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
 * STEP 07 BD HIGH / MID / LOW / OFF, ou TAP A PAD FIRST (PICK A VOICE FIRST
 * au desktop depuis la face V.4.0 sans pads, 2026-10-27 : theme.ts LCD_NO_VOICE).
 */
export function stepToggle(i: number, stage: Stage | null = null, dock = false): boolean {
  // FUNC + un pas (V.5.0, le desktop) : le mute rapide de sa voix, avant tout le reste. Le Dock (dock : une fenetre de
  // desktop etroite, sans FUNC ni REC a l'ecran) ecrit toujours comme avant
  if (DT_FACE && !dock && funcTake()) {
    funcStep(i, stage);
    return true;
  }
  // TRK engagee (2026-10-27) : le pas choisit sa voix, avant EDIT, le P-LOCK et la velocite
  if (trkStep(i, stage)) return true;
  // EDIT (2026-10-05) : les steps sont les seize patterns
  if (editor.get() === 'mm808') {
    patternTap(i, stage);
    return true;
  }
  // Le mode MUTE (V.5.0, FUNC + TRK) : les pas 1 a 8 sont les voix
  if (muteView() && !dock) {
    muteStep(i, stage);
    return true;
  }
  // LIVE REC (V.5.3) : les pas 1 a 8 jouent leur voix ; en lecture, la frappe s'ecrit
  if (DT_FACE && !dock && dtFace.live() && rytmLock.get().step < 0) {
    stepPlay(i, stage);
    return true;
  }
  // Hors REC au desktop (V.5.0) : le pas joue sa voix et la choisit, rien ne s'ecrit (le P-LOCK en cours garde sa tape)
  if (DT_FACE && !dock && !dtFace.rec() && rytmLock.get().step < 0) {
    stepPlay(i, stage);
    return true;
  }
  resume();
  stage?.pressStep(i);
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  // En LOCK (2026-10-08) : une tape sur le pas en LOCK en sort, sur un autre y deplace le LOCK (le pas ne change pas)
  if (rytmLock.get().step >= 0) {
    rytmLockTap(i);
    return true;
  }
  // Un pas vide recoit la velocite des nouveaux pas de la voix (2026-10-09 : HIGH au depart ; sans bloc depuis le 2026-10-10) ; un pas pose
  // passe au cran d'en dessous comme avant (MID, LOW, vide). REC au desktop (V.5.0, comme la Digitakt) : une tape pose ou
  // retire le pas, sans le cycle (la velocite des nouveaux pas : HIGH, ou celle de VEL sur TRIG)
  // Un lock trig (V.5.1) : une tape l'enleve, avec ses verrous (comme la Digitakt), il ne devient pas un coup
  if (DT_FACE && velocity(pattern.get().steps, inst, i) === 0 && isLockTrig(pattern.get().locks, inst, i)) {
    pattern.clearLock(inst, [i]);
    rytmPage.select(i);
    lcdMessage.show(`STEP ${two(i + 1)} ${inst} LOCK TRIG OFF`);
    return true;
  }
  if (velocity(pattern.get().steps, inst, i) === 0) pattern.set(inst, i, rytmPage.tapVel(inst));
  else if (DT_FACE) pattern.clearStep(inst, i);
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
  // Hors REC au desktop (V.5.0) : Suppr sur un pas ne l'efface pas
  if (!stepWrites()) {
    lcdMessage.show('● REC TO WRITE STEPS', 1400);
    return false;
  }
  resume();
  stage?.pressStep(i);
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  // Un lock trig (V.5.1, la revue de D2, U4) : Suppr l'enleve avec ses verrous, comme une tape (l'ecran disait OFF et le
  // laissait)
  if (velocity(pattern.get().steps, inst, i) === 0 && isLockTrig(pattern.get().locks, inst, i)) {
    pattern.clearLock(inst, [i]);
    rytmPage.select(i);
    lcdMessage.show(`STEP ${two(i + 1)} ${inst} LOCK TRIG OFF`);
    return true;
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
  // V.5.0 : hors REC au desktop, et dans le mode MUTE, un pas glisse ne change rien
  if (!stepWrites() || muteView()) return false;
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
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
  // V.5.0 : hors REC au desktop, la tenue ne met pas de P-LOCK ; l'ecran le dit une fois
  if (!stepWrites()) {
    recHoldHint();
    return;
  }
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  rytmPage.select(i);
  lcdMessage.show(`${stepLine(inst, i)}: DRAG`, POT_UI.readoutMs * 2, true);
}

/* ---------------- les patterns du MM-RYTM (EDIT, 2026-10-05) ---------------- */

/** La chaine pour l'ecran : ses patterns, les derniers s'ils ne tiennent pas (A01>A03>A02). */
function chainLine(c: readonly number[]): string {
  // Hors de la banque A (V.5.2) : le nom entier (A02>C05) ; en banque A, comme avant (01>03)
  const names = c.map((k) => (c.every((x) => bankOf(x) === 0) ? slotName(k).slice(1) : slotName(k)));
  let out = names.join('>');
  for (let k = 1; out.length > 14 && k < names.length; k += 1) out = `..${names.slice(k).join('>')}`;
  return `CHAIN ${out}`;
}

/**
 * EDIT, un step touche (k : 0 a 15) : son pattern dans la banque montree (V.5.2 : A01 a H16). A l'arret il est pose,
 * en lecture il attend la fin de la mesure ; d'autres touches dans les deux secondes en font une chaine
 * (state/patterns.ts). La vue BANK ouverte : le pas choisit la banque.
 */
export function patternTap(k: number, stage: Stage | null = null): void {
  if (DT_FACE && dtFace.bank()) {
    bankStep(k, stage);
    return;
  }
  resume();
  stage?.pressStep(k);
  const i = patterns.slotAt(k);
  const r = patterns.tap(i, clock.running);
  const p = patterns.get();
  if (r === 'chain') lcdMessage.show(chainLine(p.chain), 2600);
  else if (r === 'next') lcdMessage.show(`NEXT ${slotName(i)}: AT THE BAR`, 2000);
  else lcdMessage.show(`PATTERN ${slotName(i)}${patterns.filled(i) ? '' : ' EMPTY'}`, 2000);
}

/** EDIT, un step tenu (k : 0 a 15, la banque montree) : un emplacement vide recoit une copie du pattern courant. */
export function patternHold(k: number): void {
  if (DT_FACE && dtFace.bank()) return;
  const i = patterns.slotAt(k);
  const from = patterns.get().cur;
  if (patterns.copyTo(i)) lcdMessage.show(`COPY ${slotName(from)} > ${slotName(i)}`, 2000);
  else lcdMessage.show(i === from ? `${slotName(i)} PLAYS` : !patterns.filled(from) ? `${slotName(from)} IS EMPTY` : 'HOLD AN EMPTY SLOT TO COPY', 2000);
}

/* ---------------- les banques A a H (V.5.2, 2026-10-30, docs/v4/digitakt-d3a-spec.md section 1) ---------------- */

/** La grille PTN etait-elle ouverte sous la vue BANK (la fermer y revient ; sinon tout se ferme). */
let bankOverGrid = false;

/** FUNC + PTN : la vue BANK, les pas 1 a 8 sont les banques A a H ; encore une fois, elle se ferme. */
function bankViewToggle(stage: Stage | null): void {
  stage?.pressRytmPad('edit');
  if (dtFace.bank()) {
    bankViewClose();
    return;
  }
  // La grille gagne sur le mode MUTE, comme PTN (la revue de D3a, R2 et R10)
  if (dtFace.mute() !== 'off') dtFace.setMute('off');
  bankOverGrid = editor.get() === 'mm808';
  if (!bankOverGrid) editor.toggle('mm808');
  dtFace.setBank(true);
  lcdMessage.show(`BANK ${bankName(patterns.get().bank)} · STEPS 1-8: BANKS A-H`, 2400);
}

/** PTN, NO ou Echap dans la vue BANK : elle se ferme (la grille PTN reste si elle etait la avant). */
function bankViewClose(): void {
  dtFace.setBank(false);
  if (!bankOverGrid && editor.get() === 'mm808') editor.toggle('mm808');
  bankOverGrid = false;
  lcdMessage.show('BANK CLOSED', 900);
}

/** La vue BANK, le pas k : la banque A a H s'affiche et sa grille PTN s'ouvre (on y choisit le pattern). */
function bankStep(k: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(k);
  if (k < 0 || k >= BANKS) {
    lcdMessage.show('BANKS: STEPS 1-8 (A-H)', 1400);
    return;
  }
  patterns.setBank(k);
  dtFace.setBank(false);
  bankOverGrid = false;
  lcdMessage.show(`BANK ${bankName(k)}: PICK A PATTERN`, 2000);
}

/** MIDI rytm:bank:<b> (V.5.2) : la banque b s'affiche ; rytm:ptn:<k> y choisit ensuite le pattern k. */
export function bankKey(b: number, stage: Stage | null = null): void {
  if (DT_FACE && dtFace.bank()) {
    bankStep(b, stage);
    return;
  }
  patterns.setBank(b);
  lcdMessage.show(`BANK ${bankName(b)}`, 1400);
}

// La grille fermee (Echap, une autre machine, PTN) : la vue BANK s'en va avec elle
editor.subscribe(() => {
  if (editor.get() !== 'mm808' && dtFace.bank()) {
    dtFace.setBank(false);
    bankOverGrid = false;
  }
});

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
  // 2026-10-10 (Mika : "quand je clique sur MUTE ca release tous les mutes que j'ai cliques") : MUTE rend toutes les
  // voix ; on coupe une voix au pad (clic droit, double tape : padMute). Plus de mode a armer.
  const v = voices.get();
  // La face V.4.0 du desktop (2026-10-27, la revue) n'a plus de pad a clic droit : MUTE y arme de nouveau la machine a
  // trois etats (modeTap, comme SOLO) tant qu'aucune voix n'est coupee, ou quand le mode est deja arme (ONE puis MULTI,
  // puis OFF, les voix coupees le restent) ; la voix vient au clavier (A S D F, Z X C V) ou au MIDI (rytm:pad:<voix>,
  // padHit). Des voix coupees hors du mode : MUTE les rend toutes, comme le 2026-10-10. Le telephone ne change pas.
  if (!PORTRAIT && (v.muteMode || !v.muted.length)) return modeTap('mute');
  if (v.muted.length || v.muteMode) {
    voices.release('mute');
    lcdMessage.show('ALL VOICES ON', MODE_MSG_MS);
  } else lcdMessage.show(coarsePointer() ? LCD_MUTE_HINT.touch : LCD_MUTE_HINT.mouse, MODE_MSG_MS);
  return false;
}

/** Un ecran tactile (le doigt plutot que la souris) : l'aide de MUTE parle de double tape. */
const coarsePointer = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

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
  // UNDO (2026-10-11, state/undo.ts) : CLEAR fait son etape a lui, jamais melee au geste d'avant
  undo.boundary('mm808', 'step');
  resume();
  stage?.pressButton('clear');
  // SCENE + CLEAR (2026-10-27) : la scene armee se vide, l'autre et x restent ; une etape d'UNDO
  const sw = sceneCtl.get().armed;
  if (sw) {
    pattern.scenes.clear(sw);
    sceneCtl.use(performance.now());
    lcdMessage.show(`${SCENE_WORD[sw]} CLEARED`);
    return;
  }
  // En LOCK (2026-10-08) : CLEAR efface les verrous du pas en LOCK, rien d'autre
  if (rytmLock.active() && editor.get() !== 'mm808') {
    rytmLockClear();
    return;
  }
  clock.clear();
  // Les scenes A et B du motif aussi (2026-10-27, la phase 2 ; Mika le 2026-10-10 : "je veux tout a 0"), dans la meme etape
  const hadScenes = anyScenes(pattern.scenes.get());
  if (hadScenes) pattern.scenes.replace(NO_SCENES);
  // Tout a 0 (2026-10-10, Mika : "quand j'appuie sur CLEAR je veux tout a 0, la je vois des FX qui restent") : les
  // GLOBAL FX (SWING droit, STRETCH au centre, BIT et COMP OFF) et les FX de chaque voix
  pattern.fx.set({ drive: 0, chorus: 0, delay: 0, reverb: 0, swing: 0, bits: 0, comp: 0 });
  setStretch(0);
  // Chaque voix repart d'un son de base (2026-10-18, Mika : "quand on clear, le ADSR de chaque VOICE doit etre correct .. la
  // je me suis retrouve avec un decay 0 sur un SD clear ; ca doit etre un son de base avec une bonne enveloppe") : ses
  // reglages VOICE, FLTR, ENV et FX au neutre (audio/voicefx.ts VOICE_FX_DEFAULT : la queue entiere, l'attaque nette, le
  // filtre ouvert), les reglages de ses couches et de la machine (OPEN) a leur depart ; le son choisi (SOUND, MIX) reste
  for (const inst of INSTRUMENTS) voiceFx.reset(inst);
  const k = kit.get();
  const sample = { ...k.sample };
  /*
   * ... sauf une voix qui ne s'entend plus (2026-10-21, audit F7 : SOUND OFF, ou son MIX a 0 des deux cotes, restait
   * muette apres CLEAR, sans un mot) : son sample a elle revient seul, sinon le sample de depart de la famille, sinon la
   * synthese de sa machine ; un sample choisi n'est jamais remplace.
   */
  const layer = Object.fromEntries(
    KIT_FAMILIES.map((f) => {
      const l = k.layer[f];
      if (l.syn > 0 || (!!k.sample[f] && l.lev > 0)) return [f, { ...LAYER_DEFAULT, syn: l.syn, lev: l.lev }];
      if (k.sample[f]) return [f, { ...LAYER_DEFAULT, syn: 0, lev: 1 }];
      const def = KIT_DEFAULT.sample[f];
      if (def) {
        sample[f] = def;
        return [f, { ...LAYER_DEFAULT, syn: 0, lev: 1 }];
      }
      return [f, { ...LAYER_DEFAULT, syn: 1 }];
    })
  ) as typeof k.layer;
  kit.replace({ ...k, knob: { ...KIT_DEFAULT.knob }, sample, layer });
  lcdMessage.show(hadScenes ? 'CLEARED · VOICES RESET · FX OFF · SCENES EMPTY' : 'CLEARED · VOICES RESET · FX OFF');
}

/** Le dernier style tire par RANDOM : le suivant en change. */
let lastStyle: BeatStyle | null = null;

/**
 * RANDOM (2026-10-01 ; tous les 4x4 depuis le 2026-10-04, audio/beats.ts) :
 * un style et son motif, pour toutes les voix, plus le TONE et le VOLUME de
 * chaque voix (Mika : "le tone, le volume") ; depuis le 2026-10-14 (Mika : "le
 * random ne fais pas assez de random") aussi leur DECAY et leur PAN, et le
 * SWING du style ; depuis le 2026-10-18 aussi le SON de chaque voix, le kick
 * compris (randomVoiceSounds). La lecture continue, le
 * tempo, les autres GLOBAL FX et VOICE FX restent ceux de l'utilisateur. Le
 * bouton s'enfonce, l'ecran dit le style.
 */
export function randomPattern(stage: Stage | null = null): void {
  // UNDO : chaque RANDOM fait son etape (le precedent etait mieux : UNDO y revient)
  undo.boundary('mm808', 'step');
  resume();
  const { style, steps, swing } = randomBeat(pattern.get().steps, lastStyle);
  lastStyle = style;
  pattern.replace(steps);
  // Les reglages de trig du pattern repartent au depart, comme CLEAR (V.5.1, la revue de D2, D1 : une PROB ou une COND
  // gardee faisait taire des voix du nouveau beat) ; les verrous des pas restent, comme avant
  pattern.setTrigs(null);
  // Le SWING du style (2026-10-14) ; les autres GLOBAL FX restent ceux de l'utilisateur
  pattern.fx.set({ swing });
  const colors = randomColors();
  for (const inst of COLOR_VOICES) for (const p of ['tone', 'level', 'decay', 'pan'] as const) voiceFx.set(inst, p, colors[inst][p]);
  randomVoiceSounds();
  stage?.pressButton('random');
  lcdMessage.show(`RANDOM ${style}`);
}

/** La part des samples dans le tirage d'une voix qui en a (le kick plus encore : ses samples sont ceux de Mika). */
const RANDOM_SAMPLE_ODDS: Readonly<Partial<Record<KitFamily, number>>> = { bd: 0.85 };

/**
 * RANDOM tire aussi le son de chaque voix (2026-10-18, Mika : "au Random les sons sont replaces dans le sequenceur mais
 * je n'ai pas l'impression que les voices et les samples changent") : dans sa liste de SOUND, jamais OFF ni le son
 * qu'elle jouait ; une voix qui a des samples en prend un le plus souvent (75 %, le kick 85 %), seul a son niveau ;
 * sinon une machine (909, 808, MM). Le kick compris. Meme etape UNDO que le motif (le kit est suivi par UNDO).
 */
function randomVoiceSounds(list: readonly Inst[] = INSTRUMENTS): void {
  const k = kit.get();
  for (const inst of list) {
    const f = familyOf(inst as ShotId);
    if (!f) continue;
    const l = k.layer[f];
    const now = k.sample[f] && l.lev > 0 ? k.sample[f] : l.syn > 0 ? k.model[f] : null;
    const list = voiceSounds(inst).filter((s) => (s.kind === 'smp' || s.kind === 'mach') && s.key !== now);
    const smps = list.filter((s) => s.kind === 'smp');
    const machs = list.filter((s) => s.kind === 'mach');
    const pool = smps.length > 0 && (machs.length === 0 || Math.random() < (RANDOM_SAMPLE_ODDS[f] ?? 0.75)) ? smps : machs;
    const s = pool[Math.floor(Math.random() * pool.length)];
    if (!s) continue;
    const top = layerTop(l.syn, l.lev);
    if (s.kind === 'smp') kit.setVoice(f, { sample: s.key, syn: 0, lev: top });
    else kit.setVoice(f, { model: s.key as KitModel, syn: top, lev: 0 });
  }
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

/** SAMPLE : le son de la voix selectionnee ; l'ecran montre la liste de ses sons (le navigateur, state/lcdSamples.ts). */
function soundDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const f = soundFamily();
  if (!f) {
    lcdMessage.show(`${inst} HAS ONE SOUND`);
    return;
  }
  kit.set(f, v);
  soundBrowserFollow();
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
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    setVoiceFx(inst, p, v);
    // VOLUME d'une voix : la page MIX montre les cinq volumes (facon Elektron), sur l'ecran d'aujourd'hui
    // seulement (HOME, EDIT) ; en vue PAGE (2026-10-08) le bloc VOL de AMP montre la valeur, la ligne du bas la dit
    // Le navigateur des sons ouvert (2026-10-18) : il garde l'ecran, la valeur s'ecrit a son pied
    if (id === 'vol' && screenHome() && !lcdSamples.isOpen()) lcdMix.show(inst);
    else {
      if (!sceneHideSay(id)) lcdMessage.show(readout(id as ContEnc, dialValue(id), inst), POT_UI.readoutMs, true);
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
  // Un reglage de FX (2026-10-10) ; a crans (RATIO et HPF du COMP, 2026-10-18) : sur son cran
  else if (isFxSetting(id)) pattern.fx.set({ [id]: fxSnap(id, v) });
  else setChorus(v);
  // popup : un encodeur du desktop, son popup dit la valeur, seul (revue du 2026-10-09 : la ligne du pied en disait une
  // autre au meme instant, a la place des verrous du pas en P-LOCK)
  // Un FX global tourne (2026-10-10, Mika : "on tombe sur une page d'edition de ces FX, claire") : l'ecran passe sur
  // GLOBAL FX, le bloc tourne cerne (touchPage plus bas) ; un FX qui a sa page (DIST CHORUS DELAY REVERB BIT COMP, Mika :
  // "ca doit afficher les configurations que je peux avoir pour DELAY") : sa page, sa quantite cernee ; STRETCH et
  // SWING : GLOBAL FX
  if (popup) fxPopup(id);
  else if (!sceneHideSay(id)) lcdMessage.show(readout(id, dialValue(id), null), POT_UI.readoutMs, true);
  // Un encodeur global dont la base ne s'entend pas (revue B1) : le popup ou la page de FX, puis l'ecran dit pourquoi
  if (popup) sceneHideSay(id);
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
  if (sceneTake(id, v)) {
    // Hors scene armee (2026-10-28) : la scene entendue a suivi la main (sceneFollow) ; la page du FX s'ouvre comme avant
    if (!sceneCtl.get().armed) {
      fxPopup(id);
      touchPage(id, pattern.get().instrument);
    }
    return;
  }
  dial(id, v, true);
}

/** La page d'un FX global tourne au telephone : sa page (DIST, DELAY...), GLOBAL FX, sinon le popup de sa valeur. */
function fxPopup(id: EncId): void {
  const inst = pattern.get().instrument;
  const fd = fxDetailOf(id);
  const t = screensOf('fx', inst).indexOf('fxg');
  if (fd) rytmPage.openFx(fd, inst);
  else if (t >= 0) rytmPage.setTab('fx', t, inst);
  else rytmPage.popup(id);
}

/** La cible fixe de l'encodeur k du desktop (2026-10-09) : son FX global. */
export const globalEncId = (k: number): EncId | null => GLOBAL_ENCODERS[k] ?? null;

/* ---------------- les huit potards de la face suivent la page (2026-10-27) ---------------- */

/*
 * Mika (2026-10-27) : "les nouveaux knobs j'aime ca ! mais ils devraient etre assignes aux fonctions de la page qui est
 * cliquee, comme la DIGITAKT : 8 fonctions sur une page et eventuellement une autre page, mais les knobs de droite doivent
 * se refleter". Au desktop, le potard k de la face, le bloc pose dans la case k de l'ecran et rytm:knob:k+1 sont une seule
 * fonction (rytm/pages.ts faceBlockOf) ; un potard tourne ne change jamais de page (plus de popup ni de page de FX ouverte
 * depuis un potard) ; le telephone garde ses huit FX globaux (globalDial).
 */

/** Le bloc que tourne le potard de page k (MIDI rytm:knob, la face du desktop) : faceBlockOf sur l'ecran affiche ; k au telephone. */
export function knobBlock(k: number): number | null {
  return FACE_PAGES ? faceBlockOf(pageSlots(curScreen(), pattern.get().instrument), k) : k;
}

/** Son DialId : p:<bloc>, p:k pour une case vide (pageDial dit "G: EMPTY ON ENV"). */
export const knobDialOf = (k: number): DialId => `p:${knobBlock(k) ?? k}` as DialId;

/** Ce que tourne le potard k de la face : la page au desktop (2026-10-27), son FX global au telephone (inchange). */
export const faceDialOf = (k: number): DialId => (FACE_FOLLOWS_PAGE ? knobDialOf(k) : ((GLOBAL_ENCODERS[k] ?? 'dist') as DialId));

/**
 * Le premier toucher d'un potard (le doigt, la molette, une touche, un message MIDI) : HOME montre la page qu'il tourne
 * (jamais une autre page : l'ecran retenu). EDIT, les presets et le navigateur des sons gardent l'ecran (le potard regle
 * quand meme la page retenue, comme une Digitakt en mode pattern). true si la page s'est montree.
 */
export function revealPage(): boolean {
  if (!FACE_FOLLOWS_PAGE) return false;
  if (rytmPage.get().view === 'home' && editor.get() !== 'mm808' && !presetMode.on('mm808') && !lcdSamples.isOpen()) {
    rytmPage.setView('page');
    return true;
  }
  return false;
}

// Les cartes INFOS d'un potard de la face (rytm/infoIds.ts, pur) : le bloc qu'il tourne sur l'ecran affiche
setKnobResolver(knobBlock);
// La carte d'un pas (V.5.1) : un lock trig de la voix choisie a la sienne ; la vue BANK (V.5.2), la sienne
setStepResolver((i) => {
  if (DT_FACE && dtFace.bank() && editor.get() === 'mm808') return 'bank';
  const p = pattern.get();
  const inst = p.instrument;
  return inst && velocity(p.steps, inst, i) === 0 && isLockTrig(p.locks, inst, i) ? 'locktrig' : null;
});

/**
 * Le mode presets du desktop (2026-10-27) : une valeur absolue (MIDI, le potard motorise) devient des crans, un tous les
 * 1/PRESET_MIDI_STEPS de la course depuis la valeur d'avant du meme potard (la premiere ne fait que se poser).
 */
const PRESET_MIDI_STEPS = 24;
const presetAbs: { u: (number | undefined)[]; acc: number[] } = { u: [], acc: [] };
function presetAbsTurn(k: number, v: number): void {
  const [lo, hi] = dialRange(knobDialOf(k));
  const u = (v - lo) / (hi - lo || 1);
  const prev = presetAbs.u[k];
  presetAbs.u[k] = u;
  if (prev === undefined) return;
  const acc = (presetAbs.acc[k] ?? 0) + (u - prev) * PRESET_MIDI_STEPS;
  const n = Math.trunc(acc);
  presetAbs.acc[k] = acc - n;
  if (n) presetTurn(k, n);
}

/**
 * La derniere valeur absolue du potard k recue pendant les presets du desktop (0 a 1 ; null : aucune, ou les presets
 * fermes) : le retour MIDI la rend au controleur (midi/targets.ts rytm:knob) au lieu de la valeur de la page cachee, son
 * moteur reste sous la main ; a la sortie, la page revient (2026-10-27, la revue : le moteur repartait a la page cachee,
 * le geste suivant faisait sauter la liste ; le boitier : hw/index.ts).
 */
export function presetKnobHeld(k: number): number | null {
  if (!presetTurns()) return null;
  const u = presetAbs.u[k];
  return u === undefined || !Number.isFinite(u) ? null : Math.max(0, Math.min(1, u));
}

/** Le potard de page k tourne (rytm:knob, la face, phase 3 le potard motorise) : la page se montre, puis le bloc. */
export function knobDial(k: number, v: number, src: CtlSrc = 'ui'): void {
  // Un potard tourne n'a pas de fonction FUNC (la revue de D1, G2) : une FUNC gardee pour une touche s'en va
  funcDrop();
  // Le mode presets du desktop (2026-10-27) : le potard tourne la liste ou le nom, la page ne bouge pas
  if (presetTurns()) {
    presetAbsTurn(k, v);
    return;
  }
  faceTouch.turn(k, src);
  revealPage();
  anyDial(knobDialOf(k), v);
}

/** Le potard k de la face tourne (glisser, molette, jumeau) : knobDial au desktop, globalDial au telephone. */
export function faceKnob(k: number, v: number, src: CtlSrc = 'ui'): void {
  if (FACE_FOLLOWS_PAGE) knobDial(k, v, src);
  else globalDial(k, v);
}

/** Deux tapes, Suppr : le bloc revient a son depart, ou perd son verrou en P-LOCK ; au telephone, le FX global. */
export function faceKnobReset(k: number): void {
  if (FACE_FOLLOWS_PAGE) {
    faceTouch.turn(k, 'ui');
    revealPage();
    pageKnobReset(knobBlock(k) ?? k);
    return;
  }
  const g = GLOBAL_ENCODERS[k];
  if (g) globalDial(k, anyDialReset(g as DialId));
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
  // Le logo M (V.5.0) : FUNC s'en va (la revue de D1, G2)
  if (which === 'mm808') funcDrop();
  const ok = hoodOf(which).toggle();
  if (ok) {
    if (which === 'voy') stage?.voy?.keys.pressButton('open');
    else if (which === 'mm808') stage?.pressRytmPad('open');
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
export function escape(fromNo = false): boolean {
  // Echap annule toujours la reprise des presets fermes par l'attente (2026-10-22, la revue) : la fleche suivante
  // change de machine, comme promis
  presetMode.forget();
  // FUNC gardee (V.5.0) : Echap la relache d'abord
  if (DT_FACE && func.engaged()) {
    func.cancel();
    return true;
  }
  if (section.get() !== null) {
    section.set(null);
    return true;
  }
  // Le mode presets d'abord (2026-10-27 : un cran en arriere, le nom, OVERWRITE / AS NEW et DELETE? reviennent a la
  // liste, la liste se ferme), puis un editeur ouvert (EDIT)
  if (presetMode.get().machine) return presetMode.back();
  // Le navigateur des sons (2026-10-18) : par-dessus l'ecran (le P-LOCK compris), Echap le ferme d'abord
  if (lcdSamples.isOpen()) {
    lcdSamples.close();
    return true;
  }
  // Un CONTROL ALL en cours (V.5.2, la revue de D3a, R4) : Echap l'annule, puis eteint TRK gardee
  if (ctlAllUndo()) return true;
  // TRK gardee ou en fermeture (2026-10-27) : Echap l'eteint, avant le P-LOCK ; tenue, la main la lachera
  const tk = trk.get().mode;
  if (tk === 'latched' || tk === 'closing') {
    trk.cancel();
    return true;
  }
  // La vue BANK (V.5.2) : Echap la ferme
  if (DT_FACE && dtFace.bank()) {
    bankViewClose();
    return true;
  }
  // Le mode MUTE (V.5.0, FUNC + TRK) : Echap en sort, les mutes restent
  if (DT_FACE && dtFace.mute() !== 'off' && focus.get() === 'mm808') {
    dtFace.setMute('off');
    lcdMessage.show('MUTE MODE OFF');
    return true;
  }
  // Une scene gardee (2026-10-27) : Echap la desarme, avant le P-LOCK ; tenue, la main la lachera
  if (sceneCtl.get().how === 'latched') {
    sceneCtl.cancel();
    lcdMessage.show('SCENE OFF');
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
  // Deux machines, desktop : Echap revient a la vue d'ensemble (pas NO, la touche de la machine : V.5.0)
  if (!fromNo && VOYAGER && focus.get() !== 'all' && !window.matchMedia(MOBILE_QUERY).matches) {
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
  undo.boundary('voy', 'step');
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
  undo.boundary('voy', 'step');
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

/**
 * Le mode presets du desktop du MM-RYTM (2026-10-27, la V.4.2, rytm/presetKeys.ts) : l'ecran ne se touche plus
 * (theme.ts SCREEN_TOUCH), la face fait tout. EDIT pressee deux fois de suite les ouvre (editToggle : PATTERNS, puis
 * PRESETS dans EDIT_AGAIN_MS ; plus tard, EDIT ferme la grille) ; les cinq touches sous l'ecran apres TRK (VOICE FLTR ENV FX
 * EDIT) sont les siennes (presetSoftKey) ; un potard tourne la liste, A et B le nom (presetTurn, presetFaceKnob).
 * Le telephone garde son ecran a toucher et ses touches de page.
 */
export const presetTurns = (): boolean => !SCREEN_TOUCH && presetMode.on('mm808');

/** Un potard de la face tourne de d crans pendant le mode presets du desktop ; true s'il a servi. */
export function presetTurn(k: number, d: number): boolean {
  if (!presetTurns()) return false;
  gesture();
  funcDrop();
  return presetMode.turn('mm808', k, d);
}

/**
 * Une touche de la face sous l'ecran pendant le mode presets du desktop : la touche de l'ecran au-dessus d'elle (LOAD,
 * SAVE, NAME, DEL, EXIT ; OVERWRITE, YES, OK...) ; true si elle l'a ete (sa page, son EDIT, ne partent pas).
 */
function presetSoftKey(id: FpButtonId, press: () => void): boolean {
  if (!presetTurns()) return false;
  const slot = softSlotOf(id);
  if (!slot) return false;
  // FUNC n'a pas de sens sur une touche de l'ecran (la revue de D1, G2) : la touche fait la sienne, FUNC s'en va
  funcDrop();
  press();
  presetKey('mm808', slot);
  return true;
}

/** Entree en mode presets (2026-10-27, le clavier) : LOAD sur la liste, OK sur le nom ; rien aux questions (OVERWRITE, DELETE?). */
export function presetEnter(m: PresetMachine): void {
  const st = presetMode.get().stage;
  if (st === 'browse') presetKey(m, 'load');
  else if (st === 'name') {
    gesture();
    presetMode.nameOk(m);
  }
}

/** Une touche de l'ecran en mode presets (state/presetMode.ts), ou l'ecran touche au repos (open). */
export function presetKey(m: PresetMachine, k: PresetKey): void {
  gesture();
  // Les potards absolus (MIDI) repartent de leur prochaine valeur a chaque ouverture
  if (k === 'open') {
    presetAbs.u = [];
    presetAbs.acc = [];
  }
  // UNDO (2026-10-11, Mika : "j'ai du passer un preset nouveau.. je voulais revenir en arriere") : le geste d'avant se
  // ferme ; LOAD charge un preset (2026-10-27 : PREV et NEXT ne chargent plus, ils deplacent le curseur), son etape a
  // lui (des presets charges a la suite : une seule)
  undo.boundary(m, presetMode.loads(m, k) ? 'preset' : undefined);
  presetMode.key(m, k);
}

/**
 * EDIT (2026-10-04, Mika : "un bouton EDIT sur la machine") : l'editeur de
 * la machine s'ouvre ou se ferme (la suite de l'arpege du MM-ARP, le motif
 * et ses velocites du MM-RYTM, state/editor.ts) ; le bouton s'enfonce,
 * l'ecran le dit.
 */
/**
 * EDIT pressee encore dans ce temps (la grille des patterns vient de s'ouvrir, l'ecran dit EDIT AGAIN: PRESETS) : les
 * presets du desktop ; plus tard, EDIT ferme la grille, comme avant V.4.2 (2026-10-27, la revue P5 : EDIT ne fermait plus
 * la grille, il ouvrait les presets, un geste de tous les jours change). L'instant du geste : l'horodatage de l'evenement
 * (un fil principal pris ne le rallonge pas), sinon maintenant.
 */
const EDIT_AGAIN_MS = 1600;
let editOpenedAt = -Infinity;
function eventAt(): number {
  const now = performance.now();
  const t = typeof window !== 'undefined' ? (window as { event?: Event }).event?.timeStamp : undefined;
  return typeof t === 'number' && t > 0 && t <= now && now - t < 5000 ? t : now;
}

export function editToggle(which: EditorId, stage: Stage | null = null): void {
  // Le mode presets du desktop (2026-10-27) : EDIT est sa touche EXIT (ou CANCEL, NO), l'editeur ne s'ouvre pas
  if (which === 'mm808' && presetSoftKey('ptn', () => stage?.pressRytmPad('edit'))) return;
  gesture();
  // FUNC + PTN : BANK (V.5.2), la vue des banques A a H
  if (which === 'mm808' && funcTake()) {
    bankViewToggle(stage);
    return;
  }
  // PTN dans la vue BANK : elle se ferme
  if (which === 'mm808' && DT_FACE && dtFace.bank()) {
    stage?.pressRytmPad('edit');
    bankViewClose();
    return;
  }
  // La grille des patterns gagne sur le mode MUTE (V.5.0) : il se ferme
  if (which === 'mm808' && DT_FACE && dtFace.mute() !== 'off') dtFace.setMute('off');
  // L'ecran ne se touche plus au desktop (V.4.2, 2026-10-27, theme.ts SCREEN_TOUCH) : les presets du MM-RYTM passent par
  // EDIT pressee deux fois de suite (EDIT 2X : la grille des patterns, puis les presets, dans EDIT_AGAIN_MS) ; ouverts, EDIT
  // est leur touche EXIT (plus haut, presetSoftKey) ; presetFaceKnob y met les potards. EDIT plus tard ferme la grille.
  const t = eventAt();
  if (which === 'mm808' && !SCREEN_TOUCH && editor.get() === 'mm808' && t - editOpenedAt < EDIT_AGAIN_MS) {
    editOpenedAt = -Infinity;
    stage?.pressRytmPad('edit');
    editor.toggle('mm808');
    presetKey('mm808', 'open');
    return;
  }
  editor.toggle(which);
  const on = editor.get() === which;
  if (which === 'voy') {
    stage?.voy?.keys.pressButton('edit');
    voyMsg.show(on ? 'EDIT SEQUENCE' : 'EDIT CLOSED');
  } else {
    editOpenedAt = on ? t : -Infinity;
    stage?.pressRytmPad('edit');
    const p = patterns.get();
    // V.5.0 au desktop : PTN, et ses presets s'appellent KIT
    const again = DT_FACE ? ' · PTN AGAIN: KIT' : ' · EDIT AGAIN: PRESETS';
    lcdMessage.show(on ? `PATTERNS: ${slotName(p.cur)}${SCREEN_TOUCH ? '' : again}` : DT_FACE ? 'PTN CLOSED' : 'EDIT CLOSED', on && !SCREEN_TOUCH ? EDIT_AGAIN_MS : undefined);
  }
}

/**
 * Les presets sur les potards de la face (V.4.2, 2026-10-27 : l'ecran ne se touche plus au desktop, theme.ts SCREEN_TOUCH) :
 * un potard tourne de turn crans (le glisser, la molette ; vers la droite, vers le bas de la liste), une tape (turn 0).
 * true si le mode presets du MM-RYTM etait la (le geste est pris).
 */
export function presetFaceKnob(k: number, turn = 0): boolean {
  if (!presetTurns()) return false;
  // 2026-10-27 (la gestion des presets refaite, state/presetMode.ts) : tourner, la liste (tout potard) ou le nom (A la
  // lettre, B le curseur) ; les touches sous l'ecran font les actions (presetSoftKey), une tape de potard est prise et ne
  // fait rien (ni la page d'un FX, ni la liste des sons, cachees sous les presets)
  if (turn !== 0) presetTurn(k, turn);
  return true;
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
 * Un bouton poussoir du MM-ARP (2026-10-11, SUB OCT, Mika : "le knob Oct a
 * deux positions il faut qu'on fasse un peu d'espace ya pas un endroit
 * meilleure ? ou ptete un bouton poussoir je sais pas" ; 2026-10-12, CHORUS,
 * les modes du Juno-106) : chaque appui passe au cran suivant (-1, -2, puis
 * -1 ; OFF, I, II, puis OFF) ; la touche s'enfonce, l'ecran le dit comme pour
 * un potard (l'echo : SUB -2 OCT, CHORUS II), ses LED suivent.
 */
export function voyPush(id: VoyKnobId, stage: Stage | null = null): void {
  const n = voyKnob(id).steps?.length ?? 2;
  voyDial(id, ((stepIndex(id, voyParams.of(id)) + 1) % n) / Math.max(1, n - 1));
  stage?.voy?.keys.pressPush(id);
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
// m:<voix> (V.5.0, 2026-10-29) : le VOL d'une voix sur le MIXER (FUNC + MOD), rytm:voice:<voix>:level
// q:<reglage> (V.5.1, 2026-10-29) : un reglage de trig (TRIG) ou d'un LFO (MOD) de la voix choisie, rytm:voice:<voix>:<reglage>
export type DialId = EncId | `v:${VoyKnobId}` | `r:${KitId}` | `p:${number}` | `l:${LayerDial}` | `m:${Inst}` | `q:${SeqDial}`;

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
/** Son depart : celui du kit de depart (BD, SD et OH : SYNTH 0, leurs samples). */
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

/** Les familles dont les couches ont des cibles MIDI (rytm:layer:<famille>:<reglage>) : toutes, une par voix (2026-10-18). */
export const LAYER_TARGET_FAMS: readonly KitFamily[] = KIT_FAMILIES;
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
    // La couche SAMPLE muette (2026-10-21, audit RS-13 : une machine choisie dans SOUND la met a 0) : l'ecran le dit, le
    // sample choisi ne s'entend pas tant que SMP LEVEL reste a 0 (cette cible regle la couche, comme une Elektron)
    const mute = j > 0 && kit.layerOf(f).lev <= 0 ? '  SMP LEVEL 0' : '';
    lcdMessage.show(`${who} SAMPLE ${j === 0 ? 'OFF' : kit.sampleLabel(f)}${j === 0 ? '' : `  ${j} OF ${list.length}`}${mute}`, POT_UI.readoutMs, true);
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
    lcdMessage.show(LCD_NO_VOICE);
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
    lcdMessage.show(LCD_NO_VOICE);
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
  // La liste de SOUND de la voix (le navigateur, 2026-10-18 : une seule liste, l'ancienne couche SAMPLE y est)
  soundBrowserFollow();
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
  // La liste des samples bouge (un sample de Mika ajoute ou retire de ce navigateur, audio/samples.ts) : la liste se refait
  const sig = `${inst}|${lock ? 1 : 0}|${samplesVersion()}`;
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

/** Le mot d'un sample en echec (2026-10-21) : l'ecran dit pourquoi la voix ne le joue pas. */
const FAIL_WORD: Readonly<Record<SampleFail, string>> = { offline: 'OFFLINE', missing: 'FILE MISSING', bad: 'FILE ERROR', storage: 'STORAGE OFF', gone: 'REMOVED' };
/** Le meme, court (la colonne de droite du navigateur des sons). */
const FAIL_TAG: Readonly<Record<SampleFail, string>> = { offline: 'OFFLINE', missing: 'MISSING', bad: 'ERROR', storage: 'STORAGE', gone: 'GONE' };

/**
 * Ou en est le sample que joue p (2026-10-21, audit RS-1, Mika : "je ne veux plus que ca plante") : '' s'il est pret
 * (ou pas encore demande) ; LOADING... tant qu'il arrive (la voix garde son son d'avant) ; OFFLINE: 909 PLAYS quand il
 * n'a pas pu venir (le repli, la couche SYNTH de la voix seule, audio/shots.ts) : l'ecran et le son disent la meme chose.
 */
export function sampleStateText(p: Readonly<Plays>): string {
  if (!p.smp || !p.sample) return '';
  const st = sampleStatus(p.sample);
  if (st.state === 'loading') return 'LOADING...';
  if (st.state !== 'failed') return '';
  return `${FAIL_WORD[st.why ?? 'bad']}: ${KIT_MODEL_LABEL[p.model]} PLAYS`;
}

/** Sa ligne d'unite : SAMPLE 1 OF 6, SAMPLE + SYNTH, SYNTH, VOICE SILENT ; CY : ONE SOUND ; un sample qui arrive ou manque : LOADING..., OFFLINE: 909 PLAYS. */
export function voiceSoundUnit(inst: Inst, p: Readonly<Plays>): string {
  const own = familyOf(inst as ShotId);
  if (!own && !p.from) return 'ONE SOUND';
  if (!p.synth && !p.smp) return 'VOICE SILENT';
  const state = sampleStateText(p);
  if (state) return state;
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

/**
 * La voix joue ce son de sa liste de SOUND (hors P-LOCK ; audio/kit.ts setVoice) : OFF la fait taire ; une machine
 * joue seule a son niveau (le sample reste en memoire, MIX le ramene) ; un sample garde la synthese posee dessous s'il
 * y en avait un (MIX), sinon il joue seul a son niveau. Le potard, le navigateur des sons et un fichier depose (2026-10-18)
 * passent tous par ici.
 */
function setVoiceSound(f: KitFamily, s: Readonly<Pick<VoiceSound, 'kind' | 'key'>>): void {
  const k = kit.get();
  const l = k.layer[f];
  const top = layerTop(l.syn, l.lev);
  const smpOn = !!k.sample[f] && l.lev > 0;
  if (s.kind === 'off') kit.setVoice(f, { syn: 0, lev: 0 });
  else if (s.kind === 'mach') kit.setVoice(f, { model: s.key as KitModel, syn: top, lev: 0 });
  else if (s.kind === 'smp') kit.setVoice(f, smpOn ? { sample: s.key } : { sample: s.key, syn: 0, lev: top });
}

/** SOUND tourne (hors P-LOCK) : la voix joue ce son, le navigateur des sons s'ouvre sur lui (2026-10-18). */
function voiceSoundDial(v: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const f = soundFamily();
  if (!f) {
    lcdMessage.show(`${inst} HAS ONE SOUND: P-LOCK A SAMPLE`);
    return;
  }
  const list = voiceSounds(inst);
  setVoiceSound(f, list[Math.max(0, Math.min(list.length - 1, Math.round(v)))]);
  soundBrowserFollow();
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
    lcdMessage.show(LCD_NO_VOICE);
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
    lcdMessage.show(LCD_NO_VOICE);
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
  // Une scene armee (2026-10-27) : le bloc ecrit dans la scene, jamais dans la base (un pas tenu gagne : le P-LOCK)
  if (lk.held.length === 0 && sceneTake(`p:${k}` as DialId, v)) return;
  // En P-LOCK (2026-10-08) : le bloc pose le verrou du pas (des pas tenus), jamais la valeur de la voix
  if (lockMode()) {
    lockWrite(k, slot, v);
    return;
  }
  const before = rytmPage.get().echo;
  // CONTROL ALL (V.5.2) : TRK tenue ou gardee, la valeur d'avant des huit voix est notee avant d'ecrire
  const all = ctlAllStart(t);
  if (t === 'step:vel') tapVelDial(v);
  else if (t === 'smpl:sample') sampleDial(v);
  else if (t === 'voice:sound') voiceSoundDial(v);
  else if (t === 'voice:mix') voiceMixDial(v);
  else anyDial(t, v);
  if (all) ctlAllApply(all);
  // LIVE REC en lecture (V.5.3) : le reglage s'enregistre en P-LOCK sur les pas que traverse la tete de lecture ; TRK tenue
  // (CONTROL ALL) gagne, rien ne s'ecrit
  else if (liveRunning() && !ctlAllOn()) liveKnobTurn(slot, v);
  sceneHint(`p:${k}` as DialId);
  // Rien a regler (pas de voix choisie, une voix a un seul son) : le message suffit, pas de contour
  if (!pageKnobLive(k)) return;
  const e = rytmPage.get().echo;
  if (!e || e === before || e.k !== k || e.page !== curScreen()) rytmPage.echo(k, pattern.get().instrument);
}

/* ---------------- CONTROL ALL (V.5.2, 2026-10-30, docs/v4/digitakt-d3a-spec.md section 2) ---------------- */

/**
 * Ce que CONTROL ALL regle : un reglage de voix (VOL, PITCH, FINE, FLTR, AMP, les FX de la voix), un reglage de trig par
 * defaut ou un LFO. Les reglages de la machine de synthese et le choix du son different d'une famille a l'autre (le kick
 * n'a pas les reglages de la caisse claire) : ils restent sur la voix choisie.
 */
type CtlAllKey = { kind: 'fx'; p: VoiceParam } | { kind: 'trig'; p: TrigParam } | { kind: 'lfo'; p: LfoParam };

function ctlAllKeyOf(t: SlotTarget): CtlAllKey | null {
  const sd = seqDialOf(t);
  if (sd) return isTrigParam(sd) ? { kind: 'trig', p: sd } : { kind: 'lfo', p: sd };
  const p = t.includes(':') ? null : voiceParam(t as EncId);
  return p ? { kind: 'fx', p } : null;
}

function ctlAllGet(k: CtlAllKey, inst: Inst): number {
  if (k.kind === 'fx') return voiceFx.of(inst)[k.p];
  if (k.kind === 'trig') return pattern.get().trigs[inst]?.[k.p] ?? TRIG_DEF[k.p];
  return lfoOf(voiceFx.of(inst), k.p);
}

function ctlAllSet(k: CtlAllKey, inst: Inst, v: number): void {
  if (k.kind === 'fx') voiceFx.set(inst, k.p, v);
  else if (k.kind === 'trig') pattern.setTrig(inst, k.p, v);
  else voiceFx.setLfo(inst, k.p, v);
}

/** Les reglages touches pendant cette tenue de TRK et la valeur d'avant de chaque voix (NO les rend). */
const ctlAllBefore = new Map<string, { key: CtlAllKey; was: Record<Inst, number> }>();
/** Le pattern du CONTROL ALL en cours (la revue de D3a, R3 et R7) : un autre pattern le termine, jamais de reecriture croisee. */
let ctlAllSlot = -1;

/** TRK tenue ou gardee (la revue de D3a, R4 : gardee, elle le reste apres un CONTROL ALL). */
function ctlAllOn(): boolean {
  if (!DT_FACE) return false;
  const m = trk.get().mode;
  return m === 'held' || m === 'latched';
}

/** Avant l'ecriture : le reglage et la valeur d'avant des huit voix ; null si CONTROL ALL ne s'applique pas. */
function ctlAllStart(t: SlotTarget): CtlAllKey | null {
  if (!ctlAllOn() || !pattern.get().instrument) return null;
  const key = ctlAllKeyOf(t);
  if (!key) return null;
  // Un CONTROL ALL entier, une seule etape d'UNDO : la rafale d'avant se ferme, celle-ci reste ouverte jusqu'a sa fin
  if (ctlAllBefore.size === 0) {
    // Pendant une prise de LIVE REC (V.5.3), elle reste la seule etape : pas de coupure
    if (!dtFace.live()) undo.boundary('mm808');
    undo.hold('mm808', true);
    ctlAllSlot = patterns.get().cur;
  }
  const id = `${key.kind}:${key.p}`;
  if (!ctlAllBefore.has(id)) ctlAllBefore.set(id, { key, was: Object.fromEntries(INSTRUMENTS.map((i) => [i, ctlAllGet(key, i)])) as Record<Inst, number> });
  ctlAllState.set(true);
  return key;
}

/**
 * Apres l'ecriture : les huit voix prennent la valeur de la voix choisie (le manuel [M1] 6.2.2 ne dit pas si c'est la meme
 * valeur ou le meme ecart : le cahier tranche, la meme valeur). TRK tenue : elle a servi (son lacher ne la garde pas) ;
 * gardee : elle le reste jusqu'a une tape sur TRK, le choix d'une voix ou Echap, NO peut annuler tant qu'elle est allumee
 * (la revue de D3a, R4 ; plus de fermeture apres le lacher du potard, R5 et R6).
 */
function ctlAllApply(key: CtlAllKey): void {
  const inst = pattern.get().instrument;
  if (!inst) return;
  const v = ctlAllGet(key, inst);
  for (const o of INSTRUMENTS) if (o !== inst && ctlAllGet(key, o) !== v) ctlAllSet(key, o, v);
  if (trk.get().mode === 'held') trk.use(performance.now());
}

// La carte d'un potard pendant TRK : CONTROL ALL, seulement s'il y regle un reglage des huit voix (R12)
setCtlAllResolver((k) => {
  if (!ctlAllOn()) return false;
  const b = knobBlock(k);
  const t = b === null ? null : pageTarget(b);
  return t !== null && ctlAllKeyOf(t) !== null;
});

/** CONTROL ALL est fait (TRK eteinte, une voix choisie, un autre pattern) : les changements restent, son etape d'UNDO se ferme. */
function ctlAllEnd(): void {
  ctlAllState.set(false);
  if (ctlAllBefore.size === 0) return;
  ctlAllBefore.clear();
  ctlAllSlot = -1;
  undo.hold('mm808', false);
}

// Un autre pattern pendant le geste (la chaine qui avance, un pattern pose) : CONTROL ALL se termine (R3, R7)
patterns.subscribe(() => {
  if (ctlAllBefore.size > 0 && patterns.get().cur !== ctlAllSlot) ctlAllEnd();
});

/**
 * NO (ou Echap, le NO du desktop) tant que TRK est allumee : chaque voix retrouve sa valeur d'avant, puis TRK gardee
 * s'eteint ; true s'il y avait un CONTROL ALL a annuler.
 */
function ctlAllUndo(): boolean {
  if (ctlAllBefore.size === 0 || !trk.engaged()) return false;
  for (const { key, was } of ctlAllBefore.values()) for (const i of INSTRUMENTS) if (ctlAllGet(key, i) !== was[i]) ctlAllSet(key, i, was[i]);
  ctlAllBefore.clear();
  ctlAllSlot = -1;
  // La rafale revient a son depart : elle ne laisse aucune etape
  undo.hold('mm808', false);
  ctlAllState.set(false);
  if (trk.get().mode !== 'held') trk.cancel();
  lcdMessage.show('CONTROL ALL UNDONE', 1400);
  return true;
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
  // Une scene armee (2026-10-27) : la valeur de la scene (un Roto motorise reste ou on l'a tourne) ; sinon ce qu'on entend
  // (2026-10-28 : la base, ou ce qu'une scene en fait entendre)
  return hi > lo ? Math.max(0, Math.min(1, (dialEdit(id) - lo) / (hi - lo))) : 0;
}

/** Ce que montre le potard de page k (les anneaux de la face, P2-19) : armee la scene, en P-LOCK le verrou, sinon ce qui joue. */
export function pageKnobShown(k: number, live = false): number {
  // live : l'appelant sait deja le bloc vivant (rytm/faceKnobs.ts, sa partie fixe) : aucun texte calcule ici
  if (!live && !pageKnobLive(k)) return 0;
  const id = `p:${k}` as DialId;
  const [lo, hi] = dialRange(id);
  return hi > lo ? Math.max(0, Math.min(1, (dialShown(id) - lo) / (hi - lo))) : 0;
}

/** La cible d'un potard (un potard de page : celle de son bloc ; null, vide ou un dessin). */
const resolve = (id: DialId): SlotTarget | null => {
  const k = pageKnobOf(id);
  return k < 0 ? id : pageTarget(k);
};

export function anyDial(id: DialId, v: number): void {
  const pk = pageKnobOf(id);
  if (pk >= 0) return pageDial(pk, v);
  // Une scene armee (2026-10-27) : rytm:enc:*, les TWEAKS, les couches ; TEMPO et MASTER passent (sceneTake rend false)
  if (sceneTake(id, v)) return;
  if (!voyId(id)) sceneHint(id);
  const r = kitIdOf(id);
  if (r) return kitDial(r, v);
  const lp = layerIdOf(id);
  if (lp) return layerDial(lp, v);
  const mi = mixerInst(id);
  if (mi) return mixerDial(mi, v);
  const sd = seqDialOf(id);
  if (sd) return seqDial(sd, v);
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
  const mi = mixerInst(t);
  if (mi) return voiceFx.of(mi).level;
  const sd = seqDialOf(t);
  if (sd) return seqValue(sd);
  const k = voyId(t);
  return k ? voyParams.of(k) : dialValue(t as EncId);
}

export function anyDialReset(id: DialId): number {
  const t = resolve(id);
  if (t === null) return 0;
  // VEL : HIGH, la velocite d'un appui (celle d'avant)
  if (t === 'step:vel') return TAP_VEL_DEFAULT;
  // SMPL SAMPLE : celui du kit de depart (BD, SD, OH : le premier sample de Mika ; les autres OFF)
  if (t === 'smpl:sample') {
    const f = soundFamily();
    const key = f ? KIT_DEFAULT.sample[f] : undefined;
    return f && key ? samplesOf(f).findIndex((x) => x.key === key) + 1 : 0;
  }
  // SOUND : celui du kit de depart (BD, SD, OH : le premier sample de Mika ; les autres leur machine MM)
  if (t === 'voice:sound') {
    const f = soundFamily();
    const inst = pattern.get().instrument;
    if (!f || !inst) return 0;
    const key = KIT_DEFAULT.sample[f];
    const list = voiceSounds(inst);
    const i = key ? list.findIndex((x) => x.kind === 'smp' && x.key === key) : list.findIndex((x) => x.kind === 'mach' && x.key === KIT_DEFAULT.model[f]);
    return Math.max(0, i);
  }
  // MIX : celui du kit de depart (le sample seul pour BD, SD et OH)
  if (t === 'voice:mix') {
    const f = soundFamily();
    return f ? mixOf(KIT_DEFAULT.layer[f].syn, KIT_DEFAULT.layer[f].lev) : 0;
  }
  const r = kitIdOf(t);
  if (r) return kit.def(r);
  const lp = layerIdOf(t);
  if (lp) return layerReset(lp);
  const mi = mixerInst(t);
  if (mi) {
    setVoiceFx(mi, 'level', VOICE_FX_DEFAULT.level);
    return VOICE_FX_DEFAULT.level;
  }
  const sd = seqDialOf(t);
  if (sd) return seqDefault(sd);
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
  const sd = seqDialOf(t);
  if (sd) return seqRange(sd);
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
  // RATIO et HPF du COMP (2026-10-18, audio/pattern.ts FX_NOTCHES) : leurs crans
  if (isFxSetting(t) && FX_NOTCHES[t]) return FX_NOTCHES[t] ?? 0;
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
  // Les reglages de trig et des LFO (V.5.1) : des entiers, un cran chacun
  const sd = seqDialOf(t);
  if (sd) {
    const [lo, hi] = seqRange(sd);
    return hi - lo + 1;
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
export function dialNudge(id: DialId, n: number, set: (v: number) => void = (v) => anyDial(id, v)): void {
  if (n === 0) return;
  const [lo, hi] = dialRange(id);
  const steps = dialSteps(id);
  const notch = steps > 1 ? (hi - lo) / (steps - 1) : (hi - lo) / 127;
  // D'ou part le cran et ce qui dit qu'il a pris : la valeur de la scene armee (2026-10-27 : sans cela, un cran de molette
  // ecrivait jusqu'a huit valeurs de scene), sinon la base
  const v0 = dialEdit(id);
  for (let m = 1; m <= 8; m += 1) {
    const v = Math.min(hi, Math.max(lo, v0 + n * notch * m));
    set(Math.round(v * 10000) / 10000);
    if (dialEdit(id) !== v0 || v === lo || v === hi) return;
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
  const mi = mixerInst(id);
  if (mi) return `${mi} VOLUME ${dialValueText(id)}, ${dialUnit(id).toLowerCase()}`;
  const sd = seqDialOf(id);
  if (sd) {
    const inst = pattern.get().instrument;
    if (!inst) return 'TAP A VOICE';
    const v = seqValue(sd);
    return `${inst} ${seqName(sd)} ${seqText(sd, v)}, ${seqUnit(sd, v).toLowerCase()}`;
  }
  if (id === 'tempo') return tempoSync.label(pattern.get().bpm);
  const e = id as Exclude<EncId, 'tempo'>;
  if (isVoiceEnc(e) && !pattern.get().instrument) return 'TAP A VOICE';
  if (e === 'vsound') {
    const f = soundFamily();
    return f ? kit.readout(f) : `${pattern.get().instrument} HAS ONE SOUND`;
  }
  // Ce que montrent l'ecran et l'anneau (2026-10-27, revue B1, spec 10.3) : armee la scene, sinon ce qui joue, et le coin
  // de la scene ; sans scene, la base comme avant
  const sh = sceneNative(e, true);
  return sh === null ? readout(e, dialValue(e), dialTarget(e)) : `${readout(e, sh, dialTarget(e))}${sceneMark(e)}`;
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
  if (mixerInst(id)) {
    const v = dialShown(id);
    return encText('vol', v, v, false);
  }
  const sd = seqDialOf(id);
  if (sd) return pattern.get().instrument ? seqText(sd, seqValue(sd)) : '--';
  if (id === 'tempo') return tempoSync.text(pattern.get().bpm);
  const e = id as Exclude<EncId, 'tempo'>;
  if (isVoiceEnc(e) && !pattern.get().instrument) return '--';
  if (e === 'vsound') {
    const f = soundFamily();
    return f ? kit.valueText(f) : '--';
  }
  const v = dialShown(e);
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
  const mi = mixerInst(t);
  if (mi) return encUnit('vol', dialShown(t));
  const sd = seqDialOf(t);
  if (sd) return inst ? seqUnit(sd, seqValue(sd)) : '';
  const e = t as ContEnc;
  if (isVoiceEnc(e) && !inst) return '';
  // DLY TIME : sa duree au tempo du moment ; ce qui se montre (2026-10-27 : la scene armee, ou ce qui joue)
  if (e === 'dtime') return `${Math.round(((60 / pattern.get().bpm / 4) * delayDiv(dialShown(e)).steps) * 1000)} MS`;
  return encUnit(e, dialShown(e));
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
  // Une page que cet appareil n'a pas (V.5.0 : MOD, TRIG, TEMPO, le MIXER au telephone, par le MIDI) : rien
  if (!isRytmPage(id)) return;
  // Le mode presets du desktop (2026-10-27) : des touches de la rangee sont ses touches de l'ecran (SRC LOAD, FLTR SAVE, AMP
  // NAME, FX DEL ; PTN EXIT, editToggle)
  const btn = PAGE_BTN[id];
  if (btn && presetSoftKey(btn, () => stage?.pressPageKey(id))) return;
  // V.5.0 au desktop : FUNC + la touche, sa fonction orange ; MOD sur le MIXER, l'onglet suivant
  if (DT_FACE && dtPageKeyFirst(id, stage)) return;
  pageKeyBody(id, stage);
  if (DT_FACE && btn) dtPageKeyAfter(id);
}

/** Le chemin de toujours d'une touche de page (et des pages de FUNC au desktop). */
function pageKeyBody(id: RytmPageId, stage: Stage | null): void {
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
    // SYNTH · VOICE AGAIN: MAIN (revue du 2026-10-09 : VOICE SYNTH  VOICE AGAIN: VOI. au telephone) ; au desktop depuis le
    // 2026-10-27 l'onglet dit son rang (SYNTH 2/2 : la deuxieme page des huit potards, comme une Digitakt)
    const next = screensOf(id, inst)[(r.tab + 1) % r.tabs];
    // Un onglet nomme par son rang (V.5.1, TRIG 1/2 et 2/2) : son titre, sans rang de plus (1/2 1/2 se lisait)
    const word = (sc: RytmScreenId): string => (SCREEN_LABEL[sc].includes('/') ? SCREEN_TITLE[sc] : tabWord(sc, inst));
    const cur = curScreen();
    const rank = FACE_FOLLOWS_PAGE && !SCREEN_LABEL[cur].includes('/') ? ` ${r.tab + 1}/${r.tabs}` : '';
    lcdMessage.show(`${word(cur)}${rank} · ${pageLabel(id)} AGAIN: ${word(next)}`, 1600);
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
  // V.5.0 : TRIG, MOD, TEMPO et le MIXER sont des pages du desktop (le telephone ne les a pas)
  if (!isRytmPage(page)) return;
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

/**
 * Le menu de la voix sous HOME (2026-10-18, Mika : "je veux voir le menu dans l'ecran pour modifier le voice" ; scene/screen.ts
 * HOME_MENU) : SOUND ouvre la liste des sons de la voix ; VOICE FLTR ENV FX passent a leur page, en vue PAGE (la touche de la
 * page s'enfonce, comme sous le doigt ; la touche allumee pressee encore ramene HOME).
 */
export function rytmMenu(id: string, stage: Stage | null = null): void {
  resume();
  if (id === 'sound') {
    soundBrowserOpen();
    return;
  }
  if (!isRytmPage(id)) return;
  stage?.pressPageKey(id);
  rytmShowPage(id);
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

/** Les familles dans l'ordre de la liste (celle de la voix d'abord) : une par voix, dans l'ordre des pads (2026-10-18) ; et leur nom court. */
const LOCK_FAMS: readonly KitFamily[] = KIT_FAMILIES;
const FAM_TAG: Readonly<Record<KitFamily, string>> = { bd: 'BD', sd: 'SD', ch: 'CH', oh: 'OH', cp: 'CP', tom: 'TOM', ht: 'HT', cy: 'CY' };
const lockSoundCache = new Map<string, readonly LockSound[]>();
const lockSampleCache = new Map<string, readonly LockSound[]>();
// Un sample de Mika ajoute ou retire de ce navigateur (audio/usersamples.ts) : les listes gardees ici se refont
samplesChanged.subscribe(() => {
  voiceSoundCache.clear();
  lockSoundCache.clear();
  lockSampleCache.clear();
});

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
  // Un reglage de trig ou d'un LFO (V.5.1) : son texte et son unite a cette valeur
  const sd = slot.target ? seqDialOf(slot.target) : null;
  if (sd) {
    const [lo, hi] = seqRange(sd);
    return { text: seqText(sd, v), unit: seqUnit(sd, v, l), course: hi > lo ? (v - lo) / (hi - lo) : 0, value: v };
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
/** Les noms courts des reglages d'un LFO (V.5.1) : SPD MULT FADE DEST WAVE PHAS MODE DEP. */
const LFO_KEY_NAMES: readonly (readonly [string, string])[] = [
  ['spd', 'SPD'],
  ['mul', 'MULT'],
  ['fad', 'FADE'],
  ['dst', 'DEST'],
  ['wav', 'WAVE'],
  ['phs', 'PHAS'],
  ['mod', 'MODE'],
  ['dep', 'DEP'],
];
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
  // V.5.1 (2026-10-29) : la page TRIG et les deux LFO de MOD ; ltrg (le lock trig) n'est pas un reglage, il ne compte pas
  { key: 'len', name: 'LEN', page: 'TRIG' },
  { key: 'prob', name: 'PROB', page: 'TRIG' },
  { key: 'cond', name: 'COND', page: 'TRIG' },
  { key: 'utime', name: 'μTIME', page: 'TRIG' },
  { key: 'lfot', name: 'LFO.T', page: 'TRIG' },
  { key: 'rtrg', name: 'RTRG', page: 'TRIG' },
  { key: 'rate', name: 'RATE', page: 'TRIG' },
  { key: 'vfad', name: 'VFAD', page: 'TRIG' },
  { key: 'rlen', name: 'RLEN', page: 'TRIG' },
  ...([1, 2] as const).flatMap((n) => LFO_KEY_NAMES.map(([k, name]) => ({ key: `l${n}${k}`, name: `L${n} ${name}`, page: 'MOD' }))),
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
  const sd = seqDialOf(t);
  if (sd) return seqRange(sd);
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
    lcdMessage.show(LCD_NO_VOICE);
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
    // Un pas vide qu'on verrouille recoit un coup (la velocite des nouveaux pas) : un verrou sans coup ne s'entendrait pas ;
    // un lock trig (V.5.1) reste sans velocite, ses verrous vont au coup qui sonne
    for (const i of steps) if (velocity(pattern.get().steps, inst, i) === 0 && !isLockTrig(pattern.get().locks, inst, i)) pattern.set(inst, i, rytmPage.tapVel(inst));
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
  // Une scene armee (2026-10-27) : sa cle s'en va (le reglage revient a la base dans cette scene)
  if (sceneDrop(id)) return;
  if (!lockMode()) {
    anyDial(id, anyDialReset(id));
    return;
  }
  const slot = pageSlotOf(k);
  const inst = pattern.get().instrument;
  if (!slot || !slot.label || slot.target === null || slot.graph) return;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
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
export function rytmLockEnter(i: number, latched: boolean, dock = false): boolean {
  if (editor.get() === 'mm808') {
    // V.5.0 au desktop : la touche s'appelle PTN
    lcdMessage.show(DT_FACE ? 'CLOSE PTN TO P-LOCK A STEP' : 'CLOSE EDIT TO P-LOCK A STEP');
    return false;
  }
  // Le P-LOCK demande REC au desktop (V.5.0, comme la Digitakt) ; le Dock garde le sien
  if (!dock && !stepWrites()) {
    recHoldHint(true);
    return false;
  }
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
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
export function rytmLockToggle(i: number = rytmPage.get().sel, dock = false): void {
  const s = rytmLock.get();
  if (s.step >= 0 && (i < 0 || s.step === i)) {
    rytmLock.leave();
    lcdMessage.show('P-LOCK OFF');
    return;
  }
  if (i < 0) {
    lcdMessage.show(stepWrites() || dock ? 'HOLD A STEP TO P-LOCK IT' : '● REC + HOLD A STEP: P-LOCK');
    return;
  }
  rytmLockEnter(i, true, dock);
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
  // Les scenes, leur armement et le crossfader (2026-10-28) : un potard qu'une scene fait entendre bouge avec eux
  const offs = [voyParams.subscribe(fn), mix.subscribe(fn), voiceFx.subscribe(fn), kit.subscribe(() => fn()), pattern.subscribe(fn), pattern.fx.subscribe(fn), rytmLock.subscribe(fn), pattern.scenes.subscribe(() => fn()), sceneCtl.subscribe(fn), sceneCtl.onX(() => fn())];
  return () => {
    for (const off of offs) off();
  };
}

/** Ligne TRACKS ou MIXTAPES : lecture, pause ou reprise par le moteur SoundCloud. */
export function playItem(track: V2Track, queue: V2Track[]): void {
  sc.play(track, queue);
}


/* ---------------- le navigateur des sons du MM-RYTM (2026-10-18) ---------------- */

/*
 * Mika (2026-10-18) : "Je trouve ca difficile la selection des samples dans
 * RYTM, y aurait-il une autre facon ?". Une tape sur le nom du son (le bloc
 * SOUND de VOICE) ou un cran de SOUND ouvre toute la liste de la voix sur le
 * grand ecran (state/lcdSamples.ts, scene/screen.ts paintBrowser) ; une ligne
 * touchee la fait jouer (les regles du potard : setVoiceSound), la liste reste
 * ouverte et, a l'arret, le coup s'entend une fois (le chemin d'un pad :
 * trigger) ; en lecture, le motif le joue. PREV et NEXT (les fleches de
 * l'en-tete ; haut et bas sur le bloc SOUND au clavier) passent d'un son au
 * suivant de la meme facon. Un fichier glisse sur un pad, ou + LOAD A FILE...,
 * devient un sample de la voix (audio/usersamples.ts) et joue tout de suite ; un
 * sample de ce navigateur se retire en deux gestes (REMOVE? TAP AGAIN). En
 * P-LOCK, la liste est celle du sample lock (les samples des autres voix
 * aussi) et une ligne verrouille le pas, comme le bloc qu'on glisse.
 */

/** Une ligne du navigateur : un son de la liste de SOUND, ou la derniere, + LOAD A FILE... */
export interface BrowserRow {
  kind: VoiceSound['kind'] | 'load';
  /** la machine (909, 808, mm) ou la cle du sample ; '' pour + LOAD A FILE... */
  key: string;
  fam: KitFamily | null;
  label: string;
  /** un sample de ce navigateur : il se retire */
  user: boolean;
  /** ce que la ligne dit a sa droite : SYNTH (une machine), USER (un sample de ce navigateur), '' */
  tag: string;
}

/** Ce que l'ecran, ses zones et ses jumeaux montrent du navigateur ouvert. */
export interface SoundBrowserView {
  inst: Inst;
  /** BD SOUND */
  title: string;
  /** le pas en P-LOCK (la liste du sample lock : une ligne le verrouille), -1 hors P-LOCK */
  lock: number;
  /** les sons de la voix, puis + LOAD A FILE... */
  rows: readonly BrowserRow[];
  /** les sons seuls */
  n: number;
  /** le son du moment (en P-LOCK : ce que le pas joue) */
  cur: number;
  /** la ligne du clavier : celle du son du moment tant qu'il n'en a pas choisi une autre */
  cursor: number;
  /** la premiere ligne montree ; combien en tiennent */
  top: number;
  visible: number;
  /** la ligne qui attend sa confirmation pour partir, -1 aucune */
  arm: number;
  /** 7 / 24 */
  rank: string;
}

/** La derniere ligne : un fichier du disque ou du telephone devient un sample de la voix. */
export const BROWSER_LOAD_LABEL = '+ LOAD A FILE...';

const browserRowsCache = new WeakMap<readonly VoiceSound[], readonly BrowserRow[]>();
/** Les lignes d'une liste de SOUND (gardees tant qu'elle ne change pas : voiceSounds la garde aussi). */
function browserRows(list: readonly VoiceSound[]): readonly BrowserRow[] {
  const hit = browserRowsCache.get(list);
  if (hit) return hit;
  const rows: BrowserRow[] = list.map((s) => {
    const user = s.kind === 'smp' && !!sampleByKey(s.key)?.user;
    return { ...s, user, tag: s.kind === 'mach' ? 'SYNTH' : user ? 'USER' : '' };
  });
  rows.push({ kind: 'load', key: '', fam: null, label: BROWSER_LOAD_LABEL, user: false, tag: '' });
  browserRowsCache.set(list, rows);
  return rows;
}

/**
 * Les lignes d'un sample qui arrive ou qui manque (2026-10-21) : a droite LOADING, OFFLINE, MISSING, ERROR a la place
 * de leur mot ; les autres telles quelles (la liste gardee, sans copie, quand tout est pret).
 */
function browserStateRows(rows: readonly BrowserRow[]): readonly BrowserRow[] {
  let out: BrowserRow[] | null = null;
  rows.forEach((r, i) => {
    if (r.kind !== 'smp') return;
    const st = sampleStatus(r.key);
    const tag = st.state === 'loading' ? 'LOADING' : st.state === 'failed' ? FAIL_TAG[st.why ?? 'bad'] : '';
    if (!tag) return;
    out ??= rows.slice();
    out[i] = { ...r, tag };
  });
  return out ?? rows;
}

/** Le pas que la liste verrouille (le P-LOCK ; des pas tenus : le premier), -1 hors P-LOCK. */
function browserLockStep(): number {
  if (!lockMode()) return -1;
  const s = rytmLock.get().step;
  return s >= 0 ? s : (rytmLock.targets()[0] ?? -1);
}

/** Le rang de ce que joue la voix (en P-LOCK : le pas) dans sa liste. */
function browserCur(inst: Inst, list: readonly VoiceSound[], lock: number): number {
  return voiceSoundAt(list, lock >= 0 ? stepPlays(inst, lockOf(pattern.get().locks, inst, lock)) : kit.playsWith(inst as ShotId, null));
}

/** La premiere ligne montree, bornee (la derniere page reste pleine). */
const browserClampTop = (top: number, len: number): number => Math.max(0, Math.min(Math.max(0, len - BROWSER_ROWS), Math.round(top)));
/** La premiere ligne pour montrer i vers le haut de la liste (la troisieme ligne au desktop, la deuxieme au telephone). */
const browserCenterTop = (i: number, len: number): number => browserClampTop(i - Math.floor((BROWSER_ROWS - 1) / 2), len);

/** Le navigateur ouvert, tel que l'ecran le dessine ; null ferme (ou EDIT, les presets, pas de voix : ils ont l'ecran). */
export function soundBrowserView(): SoundBrowserView | null {
  const st = lcdSamples.get();
  if (!st.open) return null;
  const inst = pattern.get().instrument;
  if (!inst || editor.get() === 'mm808' || presetMode.on('mm808')) return null;
  const lock = browserLockStep();
  const list = voiceSounds(inst, lock >= 0);
  const rows = browserStateRows(browserRows(list));
  const cur = browserCur(inst, list, lock);
  const cursor = st.cursor >= 0 && st.cursor < rows.length ? st.cursor : cur;
  return {
    inst,
    title: `${inst} SOUND`,
    lock,
    rows,
    n: list.length,
    cur,
    cursor,
    top: browserClampTop(st.top, rows.length),
    visible: BROWSER_ROWS,
    arm: st.arm >= 0 && st.arm < rows.length && rows[st.arm].user ? st.arm : -1,
    rank: `${cur + 1} / ${list.length}`,
  };
}

/** Ce qui ferme la liste quand il change : la page et son onglet (une touche de page, [ ], H), le P-LOCK, la machine qu'on utilise. */
const browserCloseKey = (): string => {
  const s = rytmPage.get();
  return `${s.page}|${s.tabs[s.page] ?? 0}|${s.view}|${s.detail ?? ''}|${rytmLock.get().step}|${focus.get()}`;
};
let browserWatched = false;
let browserKeyAt = '';
let browserInst: Inst | null = null;

/**
 * Les regles de fermeture, posees au premier navigateur ouvert (pas au chargement du module : ses stores sont alors
 * tous la) : une touche de page, le P-LOCK qui change, une autre machine, EDIT, les presets, plus de voix choisie la
 * ferment ; une autre voix (un pad, le Dock, le MIDI) : la liste la suit, sur son son du moment.
 */
function watchBrowser(): void {
  browserKeyAt = browserCloseKey();
  browserInst = pattern.get().instrument;
  if (browserWatched) return;
  browserWatched = true;
  const check = (): void => {
    if (!lcdSamples.isOpen()) return;
    const inst = pattern.get().instrument;
    if (browserCloseKey() !== browserKeyAt || !inst || editor.get() === 'mm808' || presetMode.on('mm808')) {
      lcdSamples.close();
      return;
    }
    if (inst === browserInst) return;
    browserInst = inst;
    const v = soundBrowserView();
    if (v) lcdSamples.update({ top: browserCenterTop(v.cur, v.rows.length), cursor: -1, arm: -1 });
  };
  rytmPage.subscribe(check);
  rytmLock.subscribe(check);
  focus.subscribe(check);
  editor.subscribe(check);
  presetMode.subscribe(check);
  pattern.subscribe(check);
}

/**
 * Le navigateur s'ouvre sur la voix choisie (une tape sur SOUND, un cran de SOUND, PREV et NEXT) ; deja ouvert, son
 * repos repart. focusList : le clavier le prend (Entree sur le bloc SOUND). false : pas de voix, EDIT ou les presets.
 */
export function soundBrowserOpen(focusList = false): boolean {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  if (editor.get() === 'mm808' || presetMode.on('mm808')) return false;
  watchBrowser();
  if (lcdSamples.isOpen()) {
    lcdSamples.open(0, focusList);
    return true;
  }
  const lock = browserLockStep();
  const list = voiceSounds(inst, lock >= 0);
  lcdSamples.open(browserCenterTop(browserCur(inst, list, lock), list.length + 1), focusList);
  return true;
}

/** Fermee (Echap, une tape hors d'elle : ui/Hotspots.tsx). */
export function soundBrowserClose(): void {
  lcdSamples.close();
}

/** La ligne i en vue (le defilement le plus court). */
function browserReveal(i: number): void {
  const v = soundBrowserView();
  if (!v || i < 0) return;
  const top = i < v.top ? i : i >= v.top + v.visible ? i - v.visible + 1 : v.top;
  if (top !== v.top) lcdSamples.update({ top: browserClampTop(top, v.rows.length) });
}

/** Le son a change par un potard (SOUND, l'ancien SAMPLE, le raccourci vsound) : la liste s'ouvre et le suit. */
function soundBrowserFollow(): void {
  if (!soundBrowserOpen()) return;
  const v = soundBrowserView();
  if (!v) return;
  lcdSamples.update({ cursor: -1, arm: -1 });
  browserReveal(v.cur);
}

/** Les tests (window.__v4 n'en a pas besoin : ils importent ce module) : combien d'ecoutes, la derniere ; silent les fait taire. */
export const soundPreview = { count: 0, last: '', silent: false };
let previewSeq = 0;
/** L'ecoute attend son coup exact au plus PREVIEW_WAIT_MS une fois le fichier la (2026-10-21) : plus tard, elle se tait. */
const PREVIEW_WAIT_MS = 1500;

/**
 * L'ecoute d'un son choisi (2026-10-18) : a l'arret seulement (en lecture, le motif le joue), une fois, par le chemin
 * d'un pad (trigger, a la velocite des nouveaux pas de la voix) ; une voix coupee (MUTE) ne sonne pas. Un sample pas
 * encore decode s'attend (sinon la synthese jouerait a sa place) ; un autre choix entre-temps l'emporte.
 * lockStep : en P-LOCK, le pas tel qu'il joue (ses verrous).
 */
function previewSound(inst: Inst, lockStep = -1): void {
  if (clock.running || voices.isMuted(inst)) return;
  const n = (previewSeq += 1);
  const lock = lockStep >= 0 ? lockOf(pattern.get().locks, inst, lockStep) : null;
  const p = lock ? stepPlays(inst, lock) : kit.playsWith(inst as ShotId, null);
  const key = p.smp ? p.sample : undefined;
  // Le contexte audio dans le geste lui-meme (iOS), meme si le coup attend son fichier
  if (!soundPreview.silent) gesture();
  const live = (): boolean => n === previewSeq && !clock.running && !voices.isMuted(inst);
  const go = (): void => {
    if (!live()) return;
    soundPreview.count += 1;
    soundPreview.last = key ? `${inst} ${key}` : inst;
    if (soundPreview.silent) return;
    trigger(inst, undefined, false, undefined, VEL_GAIN[rytmPage.tapVel(inst)] ?? 1, lock);
  };
  // Le coup exact d'abord (2026-10-21, audit RS-2 : l'ecoute partait avant lui et jouait le plus ancien coup de la
  // voix, le kick par defaut, 14 fois sur 15) : son fichier (FETCH_TIMEOUT_MS au plus), puis son calcul en tete de file.
  // Un fichier qui n'a pas pu venir : le repli que la voix joue (OFFLINE: 909 PLAYS), comme le dit l'ecran
  const exact = (): void => {
    if (!live()) return;
    void shotReady(inst, lock, PREVIEW_WAIT_MS).then((ok) => {
      if (ok || soundPreview.silent) go();
    });
  };
  if (key && !samplePcm(key)) void requestSample(key).then(exact);
  else exact();
}

/*
 * Un sample du kit qui n'a pas pu venir (2026-10-21, audit RS-1) : l'ecran le dit une fois (BD ENGELHARDT: OFFLINE,
 * 909 PLAYS), pas a chaque nouvel essai ; revenu, il le dit aussi (BD ENGELHARDT LOADED).
 */
const failShown = new Map<string, string>();
const kitFamiliesOf = (key: string): KitFamily[] => KIT_FAMILIES.filter((f) => kit.get().sample[f] === key && kit.layerOf(f).lev > 0);
onSampleFailed((key, why) => {
  const fams = kitFamiliesOf(key);
  if (fams.length === 0) return;
  const f = fams[0];
  // Une fois par choix : le meme echec d'un nouvel essai se tait, un nouveau choix du meme sample le redit
  const seen = `${why}|${kit.choice(f)}`;
  if (failShown.get(key) === seen) return;
  failShown.set(key, seen);
  lcdMessage.show(`${FAM_TAG[f]} ${sampleByKey(key)?.label ?? 'SAMPLE'}: ${FAIL_WORD[why]}, ${KIT_MODEL_LABEL[kit.get().model[f]]} PLAYS`, 2400);
});
onSampleLoaded((key) => {
  if (!failShown.delete(key)) return;
  const f = kitFamiliesOf(key)[0];
  if (f) lcdMessage.show(`${FAM_TAG[f]} ${sampleByKey(key)?.label ?? 'SAMPLE'} LOADED`, 1600);
});

/**
 * Le son i du navigateur pour ce qu'il regarde : la voix (les regles du potard), ou en P-LOCK le pas (le sample lock,
 * comme le bloc glisse : un pas vide recoit un coup) ; l'ecran le dit (msg : un autre mot), la ligne reste en vue, et
 * a l'arret il s'entend.
 */
function browserChoose(v: SoundBrowserView, i: number, msg?: string): void {
  const row = v.rows[i];
  if (!row || row.kind === 'load') return;
  const inst = v.inst;
  if (v.lock >= 0) {
    const steps = rytmLock.targets();
    if (steps.length === 0) return;
    for (const s of steps) if (velocity(pattern.get().steps, inst, s) === 0) pattern.set(inst, s, rytmPage.tapVel(inst));
    soundLockWrite(inst, steps, v.lock, i);
    rytmLock.wrote();
    const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(v.lock + 1)}`;
    lcdMessage.show(msg ?? `${who} SOUND ${row.label}`, POT_UI.readoutMs, true);
  } else {
    const f = familyOf(inst as ShotId);
    if (!f || row.kind === 'own') return;
    setVoiceSound(f, row as VoiceSound);
    lcdMessage.show(msg ?? `${inst} SOUND ${row.label}  ${i + 1} OF ${v.n}`, POT_UI.readoutMs, true);
    touchPage('voice:sound', inst);
  }
  lcdSamples.update({ cursor: -1, arm: -1 });
  browserReveal(i);
  previewSound(inst, v.lock);
}

/**
 * Une ligne touchee (une tape, Entree) : son son ; + LOAD A FILE... : le choix des fichiers ; la ligne armee (REMOVE?) :
 * elle part.
 */
export function soundBrowserPick(i: number): void {
  const v = soundBrowserView();
  if (!v) return;
  const row = v.rows[i];
  if (!row) return;
  if (v.arm === i) {
    soundBrowserRemove(i);
    return;
  }
  if (row.kind === 'load') {
    lcdSamples.update({ cursor: i, arm: -1 });
    soundFilesPick(v.inst, true);
    return;
  }
  browserChoose(v, i);
}

/** PREV et NEXT (les fleches de l'en-tete ; haut et bas sur le bloc SOUND au clavier) : le son d'avant ou d'apres, la liste ouverte. */
export function soundBrowserStep(dir: -1 | 1): void {
  resume();
  if (!soundBrowserOpen()) return;
  const v = soundBrowserView();
  if (!v) return;
  const i = Math.max(0, Math.min(v.n - 1, v.cur + dir));
  if (i === v.cur) {
    lcdMessage.show(`${v.inst} SOUND: ${dir < 0 ? 'FIRST' : 'LAST'} OF ${v.n}`);
    return;
  }
  browserChoose(v, i);
}

/** La molette, un glisser, Page haut et bas : n lignes plus loin (vers le bas : n > 0). */
export function soundBrowserScroll(n: number): void {
  const v = soundBrowserView();
  if (!v || n === 0) return;
  soundBrowserScrollTo(v.top + n);
}

/** La premiere ligne montree (un doigt qui glisse la liste part de celle du toucher). */
export function soundBrowserScrollTo(top: number): void {
  const v = soundBrowserView();
  if (!v) return;
  const t = browserClampTop(top, v.rows.length);
  if (t !== v.top) lcdSamples.update({ top: t });
  else lcdSamples.touch();
}

/** Le curseur du clavier (haut, bas, Page, Debut, Fin) : n lignes plus loin, ou au bout ; la liste le suit. */
export function soundBrowserCursor(n: number, to?: 'home' | 'end'): void {
  const v = soundBrowserView();
  if (!v) return;
  const last = v.rows.length - 1;
  const i = to === 'home' ? 0 : to === 'end' ? last : Math.max(0, Math.min(last, v.cursor + n));
  lcdSamples.update({ cursor: i, arm: v.arm === i ? i : -1 });
  browserReveal(i);
}

/**
 * Un sample de ce navigateur retire (le x de sa ligne au desktop, Suppr sur elle au clavier, un appui long au
 * telephone) : le premier geste l'arme (REMOVE? TAP AGAIN, BROWSER_ARM_MS), le second le retire de la liste et de ce
 * navigateur ; la voix qui le jouait revient a sa synthese (audio/kit.ts). Un son du site ne part pas. how : le mot du
 * second geste.
 */
export function soundBrowserRemove(i: number, how: 'TAP' | 'CLICK' | 'DELETE' = coarsePointer() ? 'TAP' : 'CLICK'): void {
  const v = soundBrowserView();
  if (!v) return;
  const row = v.rows[i];
  if (!row || row.kind === 'load') return;
  if (!row.user) {
    lcdMessage.show(`${row.label}: BUILT IN, STAYS`);
    lcdSamples.touch();
    return;
  }
  if (v.arm !== i) {
    lcdSamples.update({ arm: i });
    browserReveal(i);
    lcdMessage.show(`REMOVE ${row.label}? ${how} AGAIN`, BROWSER_ARM_MS);
    return;
  }
  lcdSamples.update({ arm: -1 });
  const label = row.label;
  void userSamples.remove(row.key).then((ok) => lcdMessage.show(ok ? `${label} REMOVED` : 'STORAGE OFF', 1600));
}

/** Le champ de fichiers cache (cree au premier + LOAD A FILE...). */
let fileInput: HTMLInputElement | null = null;

/**
 * + LOAD A FILE... (2026-10-18) : le choix de fichiers du systeme (au telephone et dans Safari aussi : un vrai champ,
 * hors de la vue mais pas display none, clique dans le geste), plusieurs a la fois ; ils entrent dans la famille de la
 * voix. fromList : choisi depuis le navigateur (en P-LOCK, le premier verrouille le pas).
 */
export function soundFilesPick(inst: Inst | null = pattern.get().instrument, fromList = false): void {
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  if (typeof document === 'undefined') return;
  let el = fileInput;
  if (!el) {
    el = document.createElement('input');
    el.type = 'file';
    el.accept = 'audio/*,.wav,.aif,.aiff,.mp3,.flac,.m4a';
    el.multiple = true;
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.dataset.v4 = 'sample-file';
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    fileInput = el;
  }
  const input = el;
  // La liste ne se ferme pas d'elle-meme pendant le choix (le repos repart a son retour : un fichier, Annuler, la fenetre
  // qui reprend la main ; une minute au plus si rien ne le dit)
  const release = lcdSamples.hold();
  const stop = window.setTimeout(() => done(), 60000);
  const onFocus = (): void => {
    window.setTimeout(() => done(), 1500);
  };
  const done = (): void => {
    window.clearTimeout(stop);
    window.removeEventListener('focus', onFocus);
    release();
  };
  window.addEventListener('focus', onFocus);
  input.oncancel = done;
  input.onchange = () => {
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length > 0) void soundFilesAdd(files, inst, fromList).finally(done);
    else done();
  };
  input.value = '';
  input.click();
}

/** Le dernier ajout de fichiers parti pour chaque famille (2026-10-21) : seul lui choisit son fichier a la fin. */
let addSeq = 0;
const addLast: Partial<Record<KitFamily, number>> = {};

/**
 * Des fichiers pour une voix (glisses sur un pad, choisis par + LOAD A FILE...) : tous entrent dans sa famille
 * (audio/usersamples.ts : 10 Mo, 12 s, 60 par famille au plus), le premier joue tout de suite (les regles du potard ;
 * depuis la liste ouverte en P-LOCK, il verrouille le pas), l'ecran dit BD SAMPLE <NOM> et ce qui a ete refuse
 * (TOO BIG: 10 MB MAX...), a l'arret il s'entend. Rend le nombre de samples ajoutes.
 */
export async function soundFilesAdd(files: readonly File[], inst: Inst, fromList = false): Promise<number> {
  const f = familyOf(inst as ShotId);
  if (!f || files.length === 0) return 0;
  // Le dernier geste gagne (2026-10-21, audit RS-3) : ce qui est la au depart de l'ajout
  const token = (addSeq += 1);
  addLast[f] = token;
  const gen0 = kit.choice(f);
  const lock0 = browserLockStep();
  lcdMessage.show(`${inst} ADDING ${files.length > 1 ? `${files.length} FILES` : sampleLabel(files[0].name)}...`, 8000);
  const added: KitSample[] = [];
  const refused: string[] = [];
  // Le navigateur ouvert ne se ferme pas pendant que les fichiers entrent (un gros fichier se decode)
  const release = lcdSamples.hold();
  try {
    for (const file of files) {
      try {
        added.push(await userSamples.add(f, file));
      } catch (e) {
        refused.push(e instanceof UserSampleError ? e.text : 'NOT AUDIO');
      }
    }
  } finally {
    release();
  }
  const why = refused.length === 0 ? '' : files.length === 1 ? refused[0] : `${refused.length} REFUSED: ${refused[0]}`;
  if (added.length === 0) {
    lcdMessage.show(why || 'NOT AUDIO', 2400);
    return 0;
  }
  const s = added[0];
  // Un autre son choisi pendant l'ajout, une autre voix, un autre pas en P-LOCK, ou un ajout parti apres celui-ci : le
  // fichier entre dans la liste, sans etre choisi ni joue (avant, il ecrasait le choix fait apres lui)
  const chosen = !(addLast[f] !== token || kit.choice(f) !== gen0 || pattern.get().instrument !== inst || browserLockStep() !== lock0);
  // Seul le fichier qui va jouer garde le son decode a l'ajout (2026-10-22, revue RA1-4) : les autres le gardaient pour
  // la visite, hors du budget des samples ; ils se decodent a leur premier choix
  for (const a of chosen ? added.slice(1) : added) userSamples.release(a.key);
  if (!chosen) {
    lcdMessage.show(`${inst}: ADDED ${s.label}${added.length > 1 ? `  +${added.length - 1}` : ''}${why ? `  ${why}` : ''}`, 2400);
    return added.length;
  }
  const msg = `${inst} SAMPLE ${s.label}${added.length > 1 ? `  +${added.length - 1}` : ''}${why ? `  ${why}` : ''}`;
  const v = soundBrowserView();
  const i = v && v.inst === inst ? v.rows.findIndex((r) => r.kind === 'smp' && r.key === s.key) : -1;
  if (v && i >= 0 && (fromList || v.lock < 0)) {
    browserChoose(v, i, msg);
    return added.length;
  }
  setVoiceSound(f, { kind: 'smp', key: s.key });
  touchPage('voice:sound', inst);
  lcdMessage.show(msg, 2400);
  previewSound(inst);
  return added.length;
}

/**
 * Un fichier lache sur le MM-RYTM (2026-10-18, desktop ; ui/Hotspots.tsx) : sur un pad, sa voix (choisie, sans un
 * son) ; ailleurs sur la machine, la voix choisie ; sans voix, l'ecran demande un pad (au desktop, sans pads depuis
 * le 2026-10-27, une voix : theme.ts LCD_DROP_NO_VOICE).
 */
export function soundDrop(files: readonly File[], inst: Inst | null): void {
  lcdSamples.dragOver(null);
  const target = inst ?? pattern.get().instrument;
  if (!target) {
    lcdMessage.show(LCD_DROP_NO_VOICE);
    return;
  }
  if (files.length === 0) {
    lcdMessage.show('NOT AUDIO');
    return;
  }
  if (pattern.get().instrument !== target) selectVoice(target);
  void soundFilesAdd(files, target);
}

/* ---------------- V.5.0 : la face facon Digitakt du desktop (2026-10-29, l'etape D1) ---------------- */

/*
 * docs/v4/digitakt-d1-spec.md, section 3 (Mika : "je veux une machine qui ressemble a la Digitakt dans ses fonctions mais
 * je veux garder mon design de machine") : FUNC et sa fonction orange sous chaque touche, REC, PLAY (pause), STOP, YES et
 * NO, les pages TRIG et MOD, et les pages de FUNC (TEMPO, SEND FX, MIXER). Le desktop seulement (DT_FACE) : le telephone
 * garde sa face et ses gestes, au pixel pres. Les cibles MIDI d'avant gardent leur effet (rytm:run, rytm:clear...).
 */

/** Le message de FUNC tant qu'elle est engagee ('' : aucun). */
let funcLcd = '';
const FUNC_HINT = 'FUNC: + A KEY';
const FUNC_LOCKED = 'FUNC LOCKED: + KEYS · NO: OFF';
const funcSay = (text: string): void => {
  funcLcd = text;
  lcdMessage.show(text, TRK_HINT_MS);
};

/** FUNC enfoncee (src : 'ptr:<pointerId>', 'key' (Alt), 'at', 'midi', 'hw'). */
export function funcDown(src: string, t = performance.now()): void {
  if (!DT_FACE) return;
  resume();
  const was = func.engaged();
  func.down(src, t);
  if (!was && func.engaged()) funcSay(FUNC_HINT);
}
/** FUNC lachee ; t < 0 : un pointeur perdu ou Alt (lachee sans garde). */
export function funcUp(src: string, t = performance.now()): void {
  func.up(src, t);
}
// FUNC gardee (deux tapes) : l'ecran le dit ; eteinte, son aide s'en va avec elle
func.subscribe(() => {
  const m = func.get().mode;
  if (m === 'locked' && funcLcd !== FUNC_LOCKED) {
    funcSay(FUNC_LOCKED);
    return;
  }
  if (m !== 'off' || !funcLcd) return;
  lcdMessage.hide(funcLcd);
  funcLcd = '';
});

/**
 * La touche qui lit FUNC la consomme (V.5.0) : true quand FUNC etait engagee (tenue : elle reste ; gardee pour une touche :
 * relachee ; verrouillee : elle reste). Le telephone n'a pas de FUNC.
 */
function funcTake(): boolean {
  if (!DT_FACE || !func.engaged()) return false;
  func.use();
  return true;
}

/**
 * Une entree qui n'a pas de fonction FUNC (la revue de D1, G2 : une touche de KIT, SCENE A ou B, le logo M, un potard, un
 * pas, une voix au clavier, une cible MIDI) : elle fait la sienne et une FUNC gardee pour une touche s'en va (tenue : elle
 * sert, son lacher ne la garde pas ; verrouillee par deux tapes : elle reste). Sans cela, un PLAY bien plus tard faisait CLEAR.
 */
export function funcDrop(): void {
  if (DT_FACE && func.engaged() && func.get().mode !== 'locked') func.use();
}

/** Les pages de la rangee et leur touche (les touches de l'ecran du mode presets, rytm/presetKeys.ts). */
const PAGE_BTN: Readonly<Partial<Record<RytmPageId, FpButtonId>>> = { trig: 'trig', voice: 'src', fltr: 'fltr', env: 'amp', fx: 'fx', mod: 'mod' };

/**
 * Une touche de page tapee reste "tenue" pour YES et NO pendant DT_GESTURE.pageArmMs (une souris ne tient pas deux touches) :
 * TRIG puis YES = TRIG + YES (RANDOM), SRC puis YES = la page SRC au hasard, une page puis NO = la page rechargee du point
 * de sauvegarde. PLAY n'y est jamais pris.
 */
let pageArm: { page: RytmPageId; until: number } | null = null;
const armedPage = (t = performance.now()): RytmPageId | null => (pageArm && t <= pageArm.until ? pageArm.page : null);

/**
 * Une touche de page du desktop (la face, son jumeau, le MIDI rytm:page:<page>) avant le chemin de toujours : true quand
 * elle est prise (FUNC + la touche : sa fonction orange ; MOD sur le MIXER : l'onglet suivant).
 */
function dtPageKeyFirst(id: RytmPageId, stage: Stage | null): boolean {
  if (!funcTake()) {
    // MOD rappuye sur le MIXER (FUNC + MOD) : l'onglet suivant, LEVELS puis MASTER
    if (id === 'mod' && rytmPage.get().page === 'mixer' && rytmPage.get().view === 'page' && !presetMode.on('mm808') && editor.get() !== 'mm808') {
      stage?.pressFaceKey('pkey-mod');
      funcPage('mixer');
      return true;
    }
    return false;
  }
  resume();
  pageArm = null;
  const key = PAGE_BTN[id] ? `pkey-${id}` : null;
  if (key) stage?.pressFaceKey(key);
  switch (id) {
    case 'trig':
      funcPage('tempo');
      return true;
    case 'voice':
      // SOUNDS : la liste des sons de la voix (le navigateur d'aujourd'hui)
      if (!pattern.get().instrument) lcdMessage.show(LCD_NO_VOICE);
      else soundBrowserOpen();
      return true;
    case 'fltr':
      lcdMessage.show('SETUP (TRACK LENGTH): V.5.2', 1800);
      return true;
    case 'env':
      lcdMessage.show('EUCLID: V.5.3', 1800);
      return true;
    case 'fx':
      funcPage('sendfx');
      return true;
    case 'mod':
      funcPage('mixer');
      return true;
    default:
      return false;
  }
}

/** Une page de FUNC (TEMPO, SEND FX, MIXER) : comme une touche de page (sa page, et rappuyee l'onglet suivant ou HOME). */
function funcPage(p: RytmPageId): void {
  pageKeyBody(p, null);
  // SEND FX et le MIXER s'arment pour YES (au hasard) et NO (recharges), comme une touche de page ; TEMPO non : YES y est le TAP
  if ((p === 'sendfx' || p === 'mixer') && !presetTurns()) pageArm = { page: p, until: performance.now() + DT_GESTURE.pageArmMs };
}

/**
 * Une touche de page vraiment tenue (V.5.0, le doigt ou la souris, avant son lacher) : armee tant qu'on la tient, puis
 * DT_GESTURE.pageArmMs apres le lacher (TRIG tenue + YES = RANDOM, comme la Digitakt).
 */
export function pageKeyHold(id: string, down: boolean): void {
  if (!DT_FACE || !isRytmPage(id) || !PAGE_BTN[id]) return;
  // FUNC + la touche : sa fonction orange, la page n'est pas armee ; sous KIT non plus (une touche de l'ecran, G7)
  if (down) pageArm = func.engaged() || presetTurns() ? null : { page: id, until: Infinity };
  else if (pageArm && pageArm.page === id && pageArm.until === Infinity) pageArm = { page: id, until: performance.now() + DT_GESTURE.pageArmMs };
}

/** Apres le chemin de toujours (V.5.0) : la page reste armee pour YES et NO. */
function dtPageKeyAfter(id: RytmPageId): void {
  pageArm = presetTurns() ? null : { page: id, until: performance.now() + DT_GESTURE.pageArmMs };
}

/* ---------- REC, le mode ecriture ---------- */

/** ● REC (la face, son jumeau, W au clavier, MIDI rytm:rec) : le mode ecriture des pas ; FUNC + REC : COPY. */
export function recKey(stage: Stage | null = null): void {
  if (!DT_FACE) return;
  resume();
  stage?.pressFaceKey('rec');
  if (funcTake()) {
    copyKey();
    return;
  }
  // ● tapee deux fois vite (V.5.3, la souris ne tient pas deux touches) : LIVE REC
  const t = eventAt();
  if (t - recTapAt < PAD_DOUBLE_TAP_MS && !dtFace.live()) {
    liveEnter();
    return;
  }
  recTapAt = t;
  // ● en LIVE REC : le grid rec (le manuel [M1] 10.2.3 : "If LIVE RECORDING mode is active and [RECORD] is pressed, GRID
  // RECORDING mode will be activated")
  if (dtFace.live()) {
    liveExit(true);
    lcdMessage.show('● GRID REC · LIVE REC OFF', 1400);
    return;
  }
  const on = !dtFace.rec();
  dtFace.setRec(on);
  recHinted = false;
  // REC eteint : plus rien ne s'ecrit, le P-LOCK en cours s'en va aussi (la revue de D1, G10)
  if (!on) rytmLock.leave();
  lcdMessage.show(on ? '● REC: TAP STEPS TO WRITE, HOLD: P-LOCK' : 'REC OFF: STEPS 1-8 PLAY THE VOICES', 1600);
}
/** L'aide "le P-LOCK demande REC" dite une fois (jusqu'au prochain REC). */
let recHinted = false;
/** L'aide des pas 9 a 16 hors REC : au plus une fois toutes les DT_GESTURE.hintMs. */
let recHintAt = -Infinity;

/* ---------- PLAY, STOP ---------- */

/**
 * ▶ PLAY (la face, son jumeau, Espace, MIDI rytm:play) : a l'arret, la lecture du pas 1 ; en lecture, la pause (sa LED
 * clignote) ; en pause, la reprise au pas de la pause. Une piste SoundCloud qui joue passe en pause, comme RUN. FUNC +
 * PLAY : CLEAR. Le telephone : RUN/STOP, comme avant.
 */
export function playKey(stage: Stage | null = null): boolean {
  if (!DT_FACE) return runToggle(stage);
  gesture();
  if (funcTake()) {
    stage?.pressFaceKey('run');
    dtClear(stage);
    return clock.running;
  }
  stage?.pressButton('run');
  // ● tenue + ▶ (V.5.3, le manuel [M1] 10.2.3) : LIVE REC, la lecture part ; le lacher de ● ne fait pas REC
  if (DT_FACE && recHolders.size > 0) {
    for (const s of recHolders) recTaken.add(s);
    liveEnter();
    if (!clock.running) {
      sc.pauseForRun();
      return clock.paused ? clock.resume() : clock.toggle();
    }
    return true;
  }
  // ▶ en LIVE REC : en lecture, il en sort et la lecture continue (le manuel) ; arme a l'arret, la lecture part
  if (dtFace.live()) {
    if (clock.running) {
      liveExit(false);
      lcdMessage.show('LIVE REC OFF · STILL PLAYING', 1400);
      return true;
    }
    sc.pauseForRun();
    return clock.paused ? clock.resume() : clock.toggle();
  }
  if (clock.running) {
    clock.pause();
    lcdMessage.show('PAUSE · PLAY: RESUME · STOP: STEP 1', 1400);
    return false;
  }
  sc.pauseForRun();
  if (clock.paused) return clock.resume();
  return clock.toggle();
}

/* ---------- LIVE REC (V.5.3, 2026-10-30, docs/v4/digitakt-d3b-spec.md) ---------- */

/** Les mains sur ● (● tenue + ▶ : LIVE REC) et celles que ▶ a prises (leur lacher ne fait pas REC). */
const recHolders = new Set<string>();
const recTaken = new Set<string>();
/** La derniere tape de ● (deux en PAD_DOUBLE_TAP_MS : LIVE REC). */
let recTapAt = -Infinity;
/** ● enfoncee (la face au pointeur, W au clavier). */
export function recDown(src: string): void {
  recHolders.add(src);
}
/** ● lachee ; true si ▶ l'a prise pendant la tenue (son lacher ne fait pas REC). */
export function recUp(src: string): boolean {
  recHolders.delete(src);
  return recTaken.delete(src);
}

/** NO tenue (NO + un pad efface la voix au fil de la tete de lecture) ; celles qui ont efface (leur lacher ne fait pas NO). */
const noHolders = new Set<string>();
const noUsed = new Set<string>();
export function noDown(src: string): void {
  noHolders.add(src);
}
/** NO lachee ; true si elle a servi a effacer (son lacher ne fait pas NO). */
export function noUp(src: string): boolean {
  noHolders.delete(src);
  return noUsed.delete(src);
}

/** LIVE REC allume (arme ou en lecture), et en lecture. */
export const liveOn = (): boolean => DT_FACE && dtFace.live();
const liveRunning = (): boolean => liveOn() && clock.running;

/** La velocite d'une frappe : celle de la note MIDI, sinon HIGH (la souris, le clavier). */
function liveVel(): number {
  const v = pressVel.v;
  return v === null ? VEL_MAX : Math.max(1, Math.min(VEL_MAX, Math.round(v * VEL_MAX)));
}

/** L'heure entendue maintenant (temps du contexte) : ce qui sort des enceintes a ete programme plus tot de la latence. */
function heardNow(): number | null {
  const c = audioCtx();
  return c ? c.currentTime - ((c.outputLatency || 0) + (c.baseLatency || 0)) : null;
}

let liveTimer = 0;
let liveStep = -1;
/** Le dernier potard tourne : son bloc, sa valeur, la voix et l'heure ; il ecrit sur les pas traverses tant qu'on tourne. */
let liveKnob: { slot: PageSlot; v: number; inst: Inst; at: number } | null = null;
/** Tourne il y a moins de ce temps (ou tenu) : le potard ecrit encore sur le pas qui arrive. */
const LIVE_KNOB_MS = 220;
/** Les voix qu'on efface (NO tenue + leur pad). */
const liveErase = new Set<Inst>();

/** Entrer en LIVE REC (● tenue + ▶, ● deux fois, MIDI rytm:liverec) : arme a l'arret, tout de suite en lecture. */
function liveEnter(): void {
  if (!DT_FACE) return;
  recTapAt = -Infinity;
  if (dtFace.live()) return;
  rytmLock.leave();
  // Une prise entiere, de l'entree a la sortie : une seule etape d'UNDO
  undo.boundary('mm808');
  undo.hold('mm808', true);
  dtFace.setRec(true);
  dtFace.setLive(true);
  liveStep = -1;
  window.clearInterval(liveTimer);
  liveTimer = window.setInterval(livePoll, 15);
  lcdMessage.show(clock.running ? 'LIVE REC: PLAY STEPS 1-8, TURN A KNOB' : 'LIVE REC ARMED · PLAY: GO', 2000);
}

/** Sortir de LIVE REC ; rec : le grid rec reste allume (● en LIVE REC), sinon tout l'enregistrement s'eteint. */
function liveExit(rec: boolean): void {
  if (!dtFace.live()) return;
  dtFace.setLive(false);
  dtFace.setRec(rec);
  window.clearInterval(liveTimer);
  liveTimer = 0;
  liveErase.clear();
  liveKnob = null;
  undo.hold('mm808', false);
}

// La carte de ● en LIVE REC : LIVE REC
setLiveResolver(() => liveOn());

/** MIDI rytm:liverec : entre en LIVE REC, ou en sort (tout l'enregistrement s'eteint). */
export function liveKey(): void {
  if (!DT_FACE) return;
  resume();
  if (dtFace.live()) {
    liveExit(false);
    lcdMessage.show('LIVE REC OFF', 1000);
  } else liveEnter();
}

/**
 * Une frappe en LIVE REC et en lecture (un pas 1 a 8, un pad, le MIDI) : un trig de la voix au pas le plus proche de l'heure
 * entendue (quantifie, sans uTIME) ; arrondie vers l'avant, ce pas ne rejoue pas la voix a ce passage. at : l'heure
 * entendue (les tests), maintenant sinon. true si elle s'est ecrite.
 */
export function liveHit(inst: Inst, vel = VEL_MAX, at?: number): boolean {
  if (!liveRunning()) return false;
  const t = at ?? heardNow();
  if (t === null) return false;
  const e = clock.nearestAt(t);
  if (!e) return false;
  const was = velocity(pattern.get().steps, inst, e.step);
  if (e.when > t) clock.skipHit(inst, e.abs);
  if (was !== vel) pattern.set(inst, e.step, vel);
  // Rien n'a change au motif : le pas deja programme repasse quand meme (il ne rejoue pas la frappe)
  else if (e.when > t) clock.refresh();
  lcdMessage.show(`LIVE REC ${inst} STEP ${two(e.step + 1)}`, 700);
  return true;
}

/** Un bloc qui s'enregistre en P-LOCK (un verrou de nombre : ni le son, ni la machine, ni VEL, ni un reglage de machine entiere). */
function liveLockable(slot: PageSlot): boolean {
  if (!slot.lock || slot.lock === 'vel' || slot.lock === 'snd' || slot.lock === 'mach' || slot.scope === 'all') return false;
  if (slot.target === 'voice:sound' || slot.target === 'voice:mix' || slot.target === 'smpl:sample') return false;
  return !(slot.target && layerIdOf(slot.target) && !soundFamily());
}

/**
 * Le verrou du potard sur le pas s (le manuel [M1] 10.2.3 et 10.9.1 : en LIVE RECORDING, les reglages "are recorded as parameter
 * locks and add lock trigs where needed") : un pas sans trig de la voix recoit un lock trig.
 */
function liveLockAt(k: { slot: PageSlot; v: number; inst: Inst }, s: number): void {
  const id = k.slot.lock as LockId;
  const v = k.v;
  const val = id === 'pan' || id === 'fenv' ? (Math.abs(v) < 0.02 ? 0 : v) : id === 'tune' ? Math.round(v * 24) / 24 : v;
  const [lo, hi] = slotDomain(k.slot);
  const p = pattern.get();
  if (velocity(p.steps, k.inst, s) === 0 && !isLockTrig(p.locks, k.inst, s)) pattern.setLock(k.inst, [s], 'ltrg', 1);
  pattern.setLock(k.inst, [s], id, Math.max(lo, Math.min(hi, val)));
}

/** Un potard d'une page de voix tourne en LIVE REC : il ecrit sur le pas entendu, puis sur ceux que la tete traverse. */
function liveKnobTurn(slot: PageSlot, v: number): void {
  const inst = pattern.get().instrument;
  if (!inst || !liveLockable(slot)) return;
  liveKnob = { slot, v, inst, at: performance.now() };
  const t = heardNow();
  const e = t === null ? null : clock.entryAt(t);
  if (e) liveLockAt(liveKnob, e.step);
}

/** Efface la voix au pas s (son trig et ses verrous). */
function liveEraseAt(inst: Inst, s: number): void {
  const p = pattern.get();
  if (velocity(p.steps, inst, s) > 0) pattern.clearStep(inst, s);
  if (lockOf(pattern.get().locks, inst, s)) pattern.clearLock(inst, [s]);
}

/** NO tenue + un pad (V.5.3, LIVE REC en lecture) : la voix s'efface au fil de la tete de lecture tant qu'on tient ; true si pris. */
export function liveEraseDown(inst: Inst): boolean {
  if (!liveRunning() || noHolders.size === 0) return false;
  for (const s of noHolders) noUsed.add(s);
  liveErase.add(inst);
  const t = heardNow();
  const e = t === null ? null : clock.entryAt(t);
  if (e) liveEraseAt(inst, e.step);
  lcdMessage.show(`LIVE ERASE ${inst}`, 1200);
  return true;
}
export function liveEraseUp(inst: Inst): void {
  liveErase.delete(inst);
}

/** La tete de lecture (l'heure entendue) passe sur un autre pas : l'effacement et le potard qui tourne y ecrivent. */
function livePoll(): void {
  if (!liveRunning()) {
    liveStep = -1;
    return;
  }
  const t = heardNow();
  const e = t === null ? null : clock.entryAt(t);
  const s = e ? e.step : -1;
  if (s < 0 || s === liveStep) return;
  liveStep = s;
  for (const inst of liveErase) liveEraseAt(inst, s);
  const k = liveKnob;
  if (k && (performance.now() - k.at < LIVE_KNOB_MS || faceTouch.anyHeld())) liveLockAt(k, s);
}

let stopAt = -Infinity;
/**
 * ■ STOP (la face, son jumeau, Maj + Espace, MIDI rytm:stop) : l'arret, retour au pas 1 (la pause oubliee) ; deux fois en
 * moins de DT_GESTURE.stopDoubleMs : l'arret et les queues de la REVERB et du DELAY coupees en fondu court. FUNC + STOP :
 * PASTE.
 */
export function stopKey(stage: Stage | null = null): void {
  if (!DT_FACE) {
    if (clock.running) void runToggle(stage);
    return;
  }
  resume();
  stage?.flashFaceKey('stop');
  if (funcTake()) {
    pasteKey();
    return;
  }
  const t = eventAt();
  const dbl = t - stopAt < DT_GESTURE.stopDoubleMs;
  stopAt = dbl ? -Infinity : t;
  // LIVE REC (V.5.3, le manuel [M1] 10.2.3 : "Press [STOP] to stop both recording and playback")
  if (dtFace.live()) liveExit(false);
  clock.stop();
  if (dbl) {
    cutTails();
    lcdMessage.show('STOP · TAILS CUT');
  } else lcdMessage.show('STOP · AGAIN: CUT THE TAILS', 900);
}

/* ---------- COPY, PASTE, CLEAR (FUNC + REC, STOP, PLAY) ---------- */

/** Le presse-papiers (une seule chose) : un pattern entier, ou la ligne d'une voix. */
type Clip =
  | { kind: 'pattern'; from: number; steps: Steps; locks: Locks; scenes: SceneSet; pmutes: readonly Inst[]; trigs: TrigSet }
  | { kind: 'row'; inst: Inst; row: string; locks: Locks[Inst]; trigs: TrigRow | undefined };
let clip: Clip | null = null;

/** FUNC + REC : COPY ; hors REC le pattern (pas, verrous, scenes, mute du pattern), REC allume la ligne de la voix. */
export function copyKey(): void {
  const p = pattern.get();
  if (dtFace.rec()) {
    const inst = p.instrument;
    if (!inst) {
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    clip = { kind: 'row', inst, row: p.steps[inst], locks: p.locks[inst] ? (JSON.parse(JSON.stringify(p.locks[inst])) as Locks[Inst]) : undefined, trigs: p.trigs[inst] ? { ...p.trigs[inst] } : undefined };
    lcdMessage.show(`${inst} COPIED`);
    return;
  }
  const from = patterns.get().cur;
  clip = { kind: 'pattern', from, steps: { ...p.steps }, locks: JSON.parse(JSON.stringify(p.locks)) as Locks, scenes: pattern.scenes.get(), pmutes: [...p.pmutes], trigs: JSON.parse(JSON.stringify(p.trigs)) as TrigSet };
  lcdMessage.show(`PATTERN ${slotName(from)} COPIED`);
}

/** FUNC + STOP : PASTE ; un pattern copie remplace le pattern courant, une ligne celle de la voix choisie ; une etape d'UNDO. */
export function pasteKey(): void {
  if (!clip) {
    lcdMessage.show('NOTHING TO PASTE');
    return;
  }
  undo.boundary('mm808', 'step');
  const p = pattern.get();
  if (clip.kind === 'pattern') {
    pattern.replace(clip.steps, clip.locks);
    pattern.scenes.replace(clip.scenes);
    pattern.setPmutes(clip.pmutes);
    // Ses reglages de trig (V.5.1)
    pattern.setTrigs(clip.trigs);
    lcdMessage.show(`PATTERN ${slotName(clip.from)} PASTED ON ${slotName(patterns.get().cur)}`);
    return;
  }
  const inst = p.instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  pattern.replace({ ...p.steps, [inst]: clip.row }, withRowLocks(p.locks, inst, clip.locks));
  // Les reglages de trig de la voix copiee (V.5.1) vont avec sa ligne
  const tr: TrigSet = { ...p.trigs };
  if (clip.trigs) tr[inst] = { ...clip.trigs };
  else delete tr[inst];
  pattern.setTrigs(tr);
  lcdMessage.show(clip.inst === inst ? `${inst} PASTED` : `${clip.inst} PASTED ON ${inst}`);
}

/** Les verrous d'un pattern dont la ligne inst prend ceux-ci (absents : aucun). */
function withRowLocks(all: Readonly<Locks>, inst: Inst, row: Locks[Inst]): Locks {
  const out = JSON.parse(JSON.stringify(all)) as Locks;
  if (row && Object.keys(row).length > 0) out[inst] = JSON.parse(JSON.stringify(row)) as Locks[Inst];
  else delete out[inst];
  return out;
}

/**
 * FUNC + PLAY : CLEAR ; une scene armee se vide (la regle de SCENE + CLEAR) ; hors REC tout le pattern (clearPattern) ;
 * REC allume, la ligne de la voix choisie (ses pas et ses verrous). Une etape d'UNDO.
 */
function dtClear(stage: Stage | null): void {
  // Une scene armee, hors REC, ou un pas en P-LOCK (ses verrous) : la regle de CLEAR de toujours
  if (sceneCtl.get().armed || !dtFace.rec() || lockMode()) {
    clearPattern(stage);
    return;
  }
  const p = pattern.get();
  const inst = p.instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  undo.boundary('mm808', 'step');
  pattern.replace({ ...p.steps, [inst]: '0'.repeat(STEP_COUNT) }, withRowLocks(p.locks, inst, undefined));
  // Ses reglages de trig repartent au depart (V.5.1), comme ceux du pattern a CLEAR
  pattern.clearTrigs(inst);
  lcdMessage.show(`${inst} CLEARED`);
}

/* ---------- YES, NO, SAVE, RELOAD ---------- */

/** Le point de sauvegarde (FUNC + YES) : l'etat du MM-RYTM tel que l'UNDO le capture, et son pattern. */
let savePoint: { data: ReturnType<typeof capture>; slot: number } | null = null;

/** FUNC + YES : SAVE, le point de sauvegarde en memoire (pas retenu d'une visite a l'autre). */
export function saveKey(): void {
  savePoint = { data: JSON.parse(JSON.stringify(capture('mm808'))) as ReturnType<typeof capture>, slot: patterns.get().cur };
  lcdMessage.show(`SAVED ${slotName(savePoint.slot)}`);
}

/** FUNC + NO : RELOAD, retour au point de sauvegarde ; une etape d'UNDO. */
export function reloadKey(): void {
  if (!savePoint) {
    lcdMessage.show('NOTHING SAVED: FUNC + YES FIRST', 1800);
    return;
  }
  // Le point appartient a son pattern (la revue de D1, G1) : sur un autre emplacement, rien ne se pose
  if (savePoint.slot !== patterns.get().cur) {
    lcdMessage.show(`SAVED ON ${slotName(savePoint.slot)}`, 1800);
    return;
  }
  undo.boundary('mm808', 'step');
  apply('mm808', JSON.parse(JSON.stringify(savePoint.data)) as ReturnType<typeof capture>);
  lcdMessage.show(`RELOADED ${slotName(savePoint.slot)}`);
}

/**
 * YES (la face, son jumeau, Entree, MIDI rytm:yes) : dans KIT (les presets), valider (LOAD, OVERWRITE, YES, OK) ; sur la
 * page TEMPO, un TAP ; apres une touche de page (DT_GESTURE.pageArmMs) la page au hasard, TRIG le RANDOM du beat ; sinon
 * l'ecran dit comment. FUNC + YES : SAVE.
 */
export function yesKey(stage: Stage | null = null, armed?: RytmPageId | null): void {
  if (!DT_FACE) return;
  gesture();
  stage?.flashFaceKey('yes');
  if (funcTake()) {
    saveKey();
    return;
  }
  if (presetMode.on('mm808')) {
    presetKey('mm808', presetMode.get().stage === 'confirm' ? 'del' : 'load');
    return;
  }
  // armed (V.5.1) : la page armee a l'appui de YES (sa tape part au lacher, l'armement a pu finir entre les deux)
  const pg = armed !== undefined ? armed : armedPage();
  if (pg) {
    pageArm = null;
    if (pg === 'trig') randomPattern(null);
    else randomPage(pg);
    return;
  }
  if (rytmPage.get().view === 'page' && curScreen() === 'tempo' && editor.get() !== 'mm808') {
    tapTempo();
    return;
  }
  lcdMessage.show('YES: TAP A PAGE KEY FIRST TO RANDOMIZE IT', 2000);
}

/**
 * FILL en tenant YES (V.5.1, 2026-10-29, docs/v4/digitakt-d2-spec.md section 3) : YES enfonce (la souris, le doigt, Entree)
 * sans menu ouvert (ni KIT, ni la page TEMPO ou YES tape le tempo, ni PTN, ni la liste des sons) et sans FUNC : la touche
 * attend. Lachee avant FILL_HOLD_MS, c'est une tape, YES de D1 (la page armee au hasard, ou l'aide) ; tenue plus longtemps,
 * c'est FILL tant qu'on la tient, jamais le hasard (l'armement de la page s'en va). Avec un menu ou FUNC : YES agit tout de
 * suite, comme en D1. Le MIDI rytm:yes reste la tape de D1 ; rytm:fill tient FILL.
 */
export const FILL_HOLD_MS = 250;
const yesHolds = new Map<string, { timer: number; fill: boolean; done: boolean; now: boolean; pg: RytmPageId | null }>();

/** YES ouvre-t-il quelque chose (KIT, TEMPO, PTN, la liste des sons) : il agit a l'appui, pas de FILL. */
function yesActsNow(): boolean {
  if (func.get().mode !== 'off' || presetMode.on('mm808') || editor.get() === 'mm808' || lcdSamples.isOpen()) return true;
  return rytmPage.get().view === 'page' && curScreen() === 'tempo';
}

/**
 * YES enfonce (src : qui le tient, 'ptr:<id>', 'key'). Un menu ouvert ou FUNC : pas de FILL ; au clavier YES agit a
 * l'appui, au pointeur au lacher sur la touche (la revue de D2, U1 : comme en D1, un glisser hors d'elle annule).
 */
export function yesDown(src: string, stage: Stage | null = null): void {
  if (!DT_FACE || yesHolds.has(src)) return;
  if (yesActsNow()) {
    const ptr = src.startsWith('ptr:');
    yesHolds.set(src, { timer: 0, fill: false, done: !ptr, now: ptr, pg: null });
    if (!ptr) yesKey(stage);
    return;
  }
  gesture();
  const h = { timer: 0, fill: false, done: false, now: false, pg: armedPage() };
  h.timer = window.setTimeout(() => {
    h.timer = 0;
    h.fill = true;
    // Jamais le hasard apres une tenue : l'armement de la page s'en va
    pageArm = null;
    fill.hold(`yes:${src}`, true);
    lcdMessage.show('FILL: THE FILL TRIGS PLAY WHILE YOU HOLD YES', 1600, true);
  }, FILL_HOLD_MS);
  yesHolds.set(src, h);
  stage?.pressFaceKey('yes');
}

/** YES lache ; tap : un vrai lacher (false : le pointeur perdu, la fenetre sans clavier : rien ne part). */
export function yesUp(src: string, stage: Stage | null = null, tap = true): void {
  const h = yesHolds.get(src);
  if (!h) return;
  yesHolds.delete(src);
  if (h.done) return;
  if (h.now) {
    if (tap) yesKey(stage);
    return;
  }
  if (h.timer) {
    window.clearTimeout(h.timer);
    if (tap) yesKey(stage, h.pg);
    return;
  }
  if (h.fill) fill.hold(`yes:${src}`, false);
}

/** FILL au MIDI (rytm:fill, une cible tenue) : tenu tant que la note l'est. */
export function fillHold(down: boolean, src = 'midi'): void {
  fill.hold(src, down);
}

/**
 * NO (la face, son jumeau, Echap, MIDI rytm:no) : le retour, la chaine d'Echap ; une FUNC verrouillee se relache ; apres une
 * touche de page, cette page rechargee du point de sauvegarde. FUNC + NO (tenue ou gardee pour une touche) : RELOAD.
 */
export function noKey(stage: Stage | null = null, viaEsc = false): boolean {
  if (!DT_FACE) return escape();
  resume();
  stage?.flashFaceKey('no');
  const fm = func.get().mode;
  // Echap au clavier relache FUNC (tenue ou gardee), et revient a la vue d'ensemble au bout de sa chaine, comme toujours
  if (viaEsc && fm !== 'off') return escape();
  if (fm === 'locked') {
    func.cancel();
    lcdMessage.show('FUNC OFF', 700);
    return true;
  }
  if (fm !== 'off') {
    func.use();
    reloadKey();
    return true;
  }
  // NO ou Echap tant que TRK est allumee (V.5.2, CONTROL ALL de la Digitakt ; la revue de D3a, R4) : chaque voix retrouve sa
  // valeur d'avant
  if (ctlAllUndo()) return true;
  // La vue BANK (V.5.2) : NO la ferme
  if (dtFace.bank()) {
    bankViewClose();
    return true;
  }
  // Une page puis NO (la revue de D1, G4) : rechargee seulement par la touche NO (ou rytm:no), avec un point de sauvegarde et
  // rien d'ouvert par-dessus ; un point d'un autre pattern ne s'y pose pas (G1 : reloadPage dit SAVED ON A01) ; sinon, et
  // toujours pour Echap au clavier, la chaine d'Echap
  const pg = viaEsc ? null : armedPage();
  if (pg && savePoint && !overlayOpen()) {
    pageArm = null;
    reloadPage(pg);
    return true;
  }
  return escape(!viaEsc);
}

/** Quelque chose est-il ouvert que la chaine d'Echap fermerait avant tout (KIT, PTN, la liste des sons, un mode, une page de FX) ? */
function overlayOpen(): boolean {
  const tk = trk.get().mode;
  return (
    section.get() !== null ||
    presetMode.on('mm808') ||
    editor.get() === 'mm808' ||
    lcdSamples.isOpen() ||
    tk === 'latched' ||
    tk === 'closing' ||
    sceneCtl.get().how === 'latched' ||
    rytmLock.active() ||
    dtFace.mute() !== 'off' ||
    dtFace.bank() ||
    voices.get().muteMode ||
    voices.get().soloMode ||
    rytmInfos.isOn() ||
    !!rytmPage.get().detail ||
    hoodOf('mm808').get() === 'open'
  );
}

/* ---------- la page au hasard (une page puis YES), la page rechargee (une page puis NO) ---------- */

/** Les reglages de la voix de chaque page (audio/voicefx.ts), et ce qu'en tire le hasard : [bas, haut]. */
const PAGE_VOICE_PARAMS: Readonly<Partial<Record<RytmPageId, readonly VoiceParam[]>>> = {
  trig: ['tune'],
  voice: ['level', 'tune', 'fine'],
  fltr: ['fcut', 'freso', 'ftype', 'tone', 'fatk', 'fdec', 'fenv'],
  env: ['atk', 'hold', 'decay', 'start', 'pan'],
  fx: ['dist', 'chorus', 'delay', 'reverb'],
};
const RANDOM_SPAN: Readonly<Partial<Record<VoiceParam, readonly [number, number]>>> = {
  level: [0.55, 0.95],
  tune: [-0.25, 0.25],
  fine: [-0.2, 0.2],
  fcut: [0.35, 1],
  freso: [0, 0.6],
  ftype: [0, 1],
  tone: [-0.4, 0.4],
  fatk: [0, 0.3],
  fdec: [0.2, 0.8],
  fenv: [-0.5, 0.5],
  atk: [0, 0.25],
  hold: [0, 0.5],
  decay: [0.3, 1],
  start: [0, 0.25],
  pan: [-0.4, 0.4],
  dist: [0, 0.4],
  chorus: [0, 0.4],
  delay: [0, 0.35],
  reverb: [0, 0.45],
};
const rand = (lo: number, hi: number): number => Math.round((lo + Math.random() * (hi - lo)) * 1000) / 1000;

/**
 * Une page au hasard (V.5.0, la touche de la page puis YES) : ses reglages de la voix choisie dans des bornes musicales
 * (RANDOM_SPAN), le son de la voix sur SRC ; SEND FX les FX de la machine, TEMPO le tempo et le SWING, le MIXER les
 * niveaux des huit voix. Une etape d'UNDO ; une scene armee les prend (comme un potard).
 */
function randomPage(pg: RytmPageId): void {
  const inst = pattern.get().instrument;
  // MOD (V.5.1) : le LFO de l'onglet affiche (MOD 1/2 : LFO 1, 2/2 : LFO 2) de la voix choisie, une modulation qui s'entend
  if (pg === 'mod') {
    if (!inst) {
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    undo.boundary('mm808', 'step');
    const n = curScreen() === 'mod2' ? 2 : 1;
    const pick = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));
    const sign = (): number => (Math.random() < 0.5 ? -1 : 1);
    const set = (k: string, v: number): void => voiceFx.setLfo(inst, `l${n}${k}` as LfoParam, v);
    set('spd', sign() * pick(4, 32));
    set('mul', pick(0, 3));
    set('fad', 0);
    set('dst', pick(1, 5));
    set('wav', pick(0, 6));
    set('phs', 0);
    set('mod', pick(0, 4));
    set('dep', sign() * pick(12, 40));
    lcdMessage.show(`${inst} LFO${n} RANDOM`);
    return;
  }
  undo.boundary('mm808', 'step');
  if (pg === 'sendfx') {
    pattern.fx.set({ drive: rand(0, 0.35), chorus: rand(0, 0.35), delay: rand(0, 0.35), reverb: rand(0, 0.45), bits: Math.random() < 0.3 ? rand(0, 0.3) : 0, comp: rand(0, 0.5) });
    lcdMessage.show('SEND FX RANDOM');
    return;
  }
  if (pg === 'tempo') {
    anyDial('tempo', Math.round(rand(110, 140)));
    pattern.fx.set({ swing: rand(0, 0.35) });
    lcdMessage.show(`TEMPO RANDOM ${Math.round(pattern.get().bpm)} BPM`);
    return;
  }
  if (pg === 'mixer') {
    for (const v of INSTRUMENTS) mixerSet(v, rand(0.55, 0.95));
    lcdMessage.show('MIXER RANDOM');
    return;
  }
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  for (const p of PAGE_VOICE_PARAMS[pg] ?? []) {
    const [lo, hi] = RANDOM_SPAN[p] ?? [0.2, 0.8];
    const v = p === 'ftype' ? [0, 0.5, 1][Math.floor(Math.random() * 3)] : rand(lo, hi);
    const id = `rytm:voice:${inst}:${p}`;
    const bip = p === 'tone' || p === 'tune' || p === 'pan' || p === 'fine' || p === 'fenv';
    if (!sceneTakeId(id, bip ? (v + 1) / 2 : v)) setVoiceFx(inst, p, v);
  }
  if (pg === 'voice') randomVoiceSounds([inst]);
  lcdMessage.show(`${inst} ${pageLabel(pg)} RANDOM`);
}

/**
 * Une page rechargee du point de sauvegarde (V.5.0, la touche de la page puis NO) : ses reglages de la voix choisie ; SEND
 * FX les FX de la machine et STRETCH, TEMPO le tempo et le SWING, le MIXER les niveaux. Le son de SRC et les potards de
 * machine de SRC SYNTH reviennent avec FUNC + NO (tout le point). Une etape d'UNDO.
 */
function reloadPage(pg: RytmPageId): void {
  if (!savePoint) {
    lcdMessage.show('NOTHING SAVED: FUNC + YES FIRST', 1800);
    return;
  }
  if (savePoint.slot !== patterns.get().cur) {
    lcdMessage.show(`SAVED ON ${slotName(savePoint.slot)}`, 1800);
    return;
  }
  const d = savePoint.data as { voices?: Partial<Record<Inst, Partial<VoiceFx>>>; fx?: Record<string, number>; stretch?: number; bpm?: number };
  undo.boundary('mm808', 'step');
  if (pg === 'sendfx') {
    if (d.fx) pattern.fx.set({ ...d.fx });
    setStretch(typeof d.stretch === 'number' ? d.stretch : 0);
  } else if (pg === 'tempo') {
    if (typeof d.bpm === 'number') pattern.setBpm(d.bpm);
    if (d.fx && typeof d.fx.swing === 'number') pattern.fx.set({ swing: d.fx.swing });
  } else if (pg === 'mixer') {
    for (const v of INSTRUMENTS) {
      const l = d.voices?.[v]?.level;
      if (typeof l === 'number') voiceFx.set(v, 'level', l);
    }
  } else {
    const inst = pattern.get().instrument;
    if (!inst) {
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    const saved = d.voices?.[inst];
    for (const p of PAGE_VOICE_PARAMS[pg] ?? []) voiceFx.set(inst, p, typeof saved?.[p] === 'number' ? (saved[p] as number) : VOICE_FX_DEFAULT[p]);
    // V.5.1 : MOD, les deux LFO de la voix ; TRIG, ses reglages de trig par defaut (ceux du pattern au point de sauvegarde)
    if (pg === 'mod') {
      for (const p of LFO_PARAMS) {
        const v = (saved as Partial<Record<string, number>> | undefined)?.[p];
        voiceFx.setLfo(inst, p, typeof v === 'number' ? v : lfoDefault(p));
      }
    }
    if (pg === 'trig') {
      const row = (savePoint.data as { trigs?: TrigSet }).trigs?.[inst];
      for (const p of TRIG_PARAMS) pattern.setTrig(inst, p, typeof row?.[p] === 'number' ? (row[p] as number) : TRIG_DEF[p]);
    }
  }
  lcdMessage.show(`${pageLabel(pg)} RELOADED FROM ${slotName(savePoint.slot)}`);
}

/* ---------- TAP TEMPO (YES sur la page TEMPO) ---------- */

let taps: number[] = [];
/** Un TAP : la moyenne des intervalles apres DT_GESTURE.tapTaps tapes, arrondie au BPM, bornee a BPM (100 a 150). */
function tapTempo(): void {
  const t = eventAt();
  if (taps.length > 0 && t - taps[taps.length - 1] > DT_GESTURE.tapResetMs) taps = [];
  taps.push(t);
  if (taps.length > 8) taps.shift();
  if (taps.length < DT_GESTURE.tapTaps) {
    lcdMessage.show(`TAP ${taps.length}/${DT_GESTURE.tapTaps}`, 1200);
    return;
  }
  const ms = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  const bpm = Math.max(BPM.min, Math.min(BPM.max, Math.round(60000 / ms)));
  anyDial('tempo', bpm);
  lcdMessage.show(`TAP TEMPO ${Math.round(pattern.get().bpm)} BPM`, 1400);
}

/* ---------- le mode MUTE (FUNC + TRK) ---------- */

/**
 * FUNC + TRK (V.5.0, la face, MIDI rytm:mutemode) : le mode MUTE global (les pas 1 a 8 sont les voix : vert joue, eteint
 * coupee) ; encore, le mute du pattern (magenta, garde avec le pattern) ; encore, la sortie (les mutes restent).
 */
export function muteModeKey(): void {
  if (!DT_FACE) return;
  resume();
  const m = dtFace.mute();
  const next: MuteView = m === 'off' ? 'global' : m === 'global' ? 'pattern' : 'off';
  if (next !== 'off') {
    // Les vues gagnent sur les pas une a la fois : TRK et la grille PTN se ferment
    trk.cancel();
    if (editor.get() === 'mm808') editor.close();
  }
  dtFace.setMute(next);
  lcdMessage.show(next === 'global' ? 'GLOBAL MUTE · FUNC + TRK: PATTERN MUTE' : next === 'pattern' ? 'PATTERN MUTE · FUNC + TRK: EXIT' : 'MUTE MODE OFF', 1600);
}

/** Un pas tape en mode MUTE : 1 a 8 coupent leur voix ou la rendent (le jeu global ou celui du pattern). */
function muteStep(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst) {
    lcdMessage.show('MUTE: STEPS 1-8 ARE THE VOICES');
    return;
  }
  if (dtFace.mute() === 'pattern') {
    undo.boundary('mm808', 'step');
    pattern.togglePmute(inst);
    lcdMessage.show(`${inst} ${pattern.pmuted(inst) ? 'MUTED IN THE PATTERN' : 'BACK IN THE PATTERN'}`);
    return;
  }
  voices.toggleMute(inst);
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'BACK'}`);
}

/** Un pas tenu en mode MUTE (DT_GESTURE.muteHoldMs) : le SOLO de sa voix (blanc), tenu encore la fin du SOLO. */
export function muteStepHold(i: number, stage: Stage | null = null): void {
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst || !DT_FACE || dtFace.mute() === 'off') return;
  stage?.pressStep(i);
  voices.toggleSolo(inst);
  lcdMessage.show(voices.get().solo.includes(inst) ? `SOLO ${inst}` : `${inst} SOLO OFF`);
}

/** Le mode MUTE est-il ouvert (les pas sont les voix, la tenue d'un pas est le SOLO) ? */
export const muteView = (): boolean => DT_FACE && dtFace.mute() !== 'off';

/** FUNC + un pas (V.5.0) : 1 a 8, le mute rapide de leur voix (le jeu global) ; 13 a 16, les pages a venir. En REC (V.5.1) : le lock trig. */
function funcStep(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  // En REC (V.5.1) : le lock trig de la voix choisie ; hors REC, le mute rapide de D1
  if (dtFace.rec() && editor.get() !== 'mm808' && !muteView()) {
    lockTrigStep(i);
    return;
  }
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (inst) {
    voices.toggleMute(inst);
    lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'BACK'}`);
    return;
  }
  if (i >= 12) lcdMessage.show('PAGES 1-4: V.5.2', 1600);
}

/**
 * FUNC + un pas en REC (V.5.1, le lock trig de la Digitakt) : sur un pas vide, un lock trig (jaune, sans note : ses verrous
 * vont au coup de la voix qui sonne encore) ; sur un lock trig, il s'en va avec ses verrous ; sur un pas qui joue, il devient
 * un lock trig (ses verrous restent). Tenir le pas puis tourner un potard y pose ses verrous (le P-LOCK de toujours).
 */
function lockTrigStep(i: number): void {
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const p = pattern.get();
  const vel = velocity(p.steps, inst, i);
  if (vel === 0 && isLockTrig(p.locks, inst, i)) {
    pattern.clearLock(inst, [i]);
    lcdMessage.show(`STEP ${two(i + 1)} ${inst} LOCK TRIG OFF`);
    return;
  }
  if (vel > 0) pattern.set(inst, i, 0);
  pattern.setLock(inst, [i], 'ltrg', 1);
  rytmPage.select(i);
  lcdMessage.show(vel > 0 ? `STEP ${two(i + 1)} ${inst} NOW A LOCK TRIG` : `STEP ${two(i + 1)} ${inst} LOCK TRIG: HOLD + KNOB`, 1800);
}

/**
 * Un pas hors REC au desktop (V.5.0, TRK SELECT NORMAL de la Digitakt II) : 1 a 8, sa voix joue (le chemin d'un pad, a la
 * velocite HIGH, meme en lecture) et devient la voix choisie ; rien ne s'ecrit. 9 a 16 : rien ne joue, l'ecran dit de
 * passer en REC (au plus une fois toutes les DT_GESTURE.hintMs).
 */
function stepPlay(i: number, stage: Stage | null): void {
  gesture();
  stage?.pressStep(i);
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst) {
    const now = performance.now();
    if (now - recHintAt >= DT_GESTURE.hintMs) {
      recHintAt = now;
      lcdMessage.show('● REC TO WRITE STEPS', 1400);
    }
    return;
  }
  // Les modes MUTE et SOLO d'avant (M et Maj + M au clavier, MIDI rytm:mute) : la voix touchee y bascule, comme un pad
  const v = voices.get();
  if (v.soloMode || v.muteMode) {
    padHit(inst, null);
    return;
  }
  const n = liveRunning() ? liveVel() : TAP_VEL_DEFAULT;
  if (!voices.isMuted(inst) && !pattern.pmuted(inst)) trigger(inst, undefined, false, undefined, VEL_GAIN[n] ?? 1);
  // LIVE REC en lecture (V.5.3) : la frappe s'ecrit (une voix coupee aussi)
  if (liveHit(inst, n)) return;
  if (pattern.get().instrument !== inst) selectVoice(inst);
  else lcdMessage.show(`${inst} · ● REC TO WRITE STEPS`, 900);
}

/** La tenue d'un pas hors REC au desktop : pas de P-LOCK (il demande REC, comme la Digitakt) ; l'ecran le dit une fois. */
function recHoldHint(force = false): void {
  if (recHinted && !force) return;
  recHinted = true;
  lcdMessage.show('P-LOCK NEEDS ● REC: TURN REC ON, THEN HOLD A STEP', 2200);
}

/** Le P-LOCK et la velocite d'un pas sont-ils possibles (REC allume au desktop ; toujours au telephone) ? */
export const stepWrites = (): boolean => !DT_FACE || dtFace.rec();

/* ---------- le MIXER (FUNC + MOD) : le VOL de chaque voix ---------- */

const mixerInst = (id: DialId | SlotTarget | string): Inst | null => (typeof id === 'string' && id.startsWith('m:') && (INSTRUMENTS as readonly string[]).includes(id.slice(2)) ? (id.slice(2) as Inst) : null);
/** Le VOL d'une voix du MIXER (0 a 1) : une scene armee le prend, une scene qui le fait entendre suit la main. */
function mixerSet(inst: Inst, v: number): void {
  const id = `rytm:voice:${inst}:level`;
  const x = Math.max(0, Math.min(1, v));
  if (sceneTakeId(id, x)) return;
  if (!sceneFollowId(id, x, voiceFx.of(inst).level, (w) => setVoiceFx(inst, 'level', w))) setVoiceFx(inst, 'level', x);
}
/** Le potard d'un bloc du MIXER, apres les scenes (anyDial les a deja servies) : le VOL de la voix, et l'ecran le dit. */
function mixerDial(inst: Inst, v: number): void {
  resume();
  setVoiceFx(inst, 'level', Math.max(0, Math.min(1, v)));
  lcdMessage.show(`${inst} VOL ${encText('vol', voiceFx.of(inst).level, voiceFx.of(inst).level, false)}  ${encUnit('vol', voiceFx.of(inst).level)}`, POT_UI.readoutMs, true);
}

/* ---------- TRIG et MOD (V.5.1, 2026-10-29, l'etape D2) : q:<reglage>, la voix choisie ---------- */

/** Un reglage de trig (audio/trig.ts) ou d'un LFO (audio/lfo.ts) de la voix choisie. */
export type SeqDial = TrigParam | LfoParam;
export const seqDialOf = (id: DialId | SlotTarget | string | null): SeqDial | null => {
  if (typeof id !== 'string' || !id.startsWith('q:')) return null;
  const p = id.slice(2);
  return isTrigParam(p) || isLfoParam(p) ? p : null;
};
const SEQ_NAME: Readonly<Record<TrigParam, string>> = { len: 'LEN', prob: 'PROB', cond: 'COND', utime: 'μTIME', lfot: 'LFO.T', rtrg: 'RTRG', rate: 'RATE', vfad: 'VFAD', rlen: 'RLEN' };
/** Son nom a l'ecran : LEN, LFO1 DEP. */
function seqName(p: SeqDial): string {
  if (isTrigParam(p)) return SEQ_NAME[p];
  const { n, key } = lfoParts(p);
  return `LFO${n} ${LFO_KEY_NAMES.find(([k]) => k === key)?.[1] ?? key.toUpperCase()}`;
}
export const seqRange = (p: SeqDial): [number, number] => {
  const r = isTrigParam(p) ? TRIG_RANGE[p] : lfoRange(p);
  return [r[0], r[1]];
};
const seqDefault = (p: SeqDial): number => (isTrigParam(p) ? TRIG_DEF[p] : lfoDefault(p));
/** Sa valeur pour la voix choisie : le defaut de la voix dans le pattern (TRIG), son reglage de voix (MOD). */
function seqValue(p: SeqDial): number {
  const inst = pattern.get().instrument;
  if (!inst) return seqDefault(p);
  return isTrigParam(p) ? trigValue(pattern.get().trigs, inst, p) : lfoOf(voiceFx.of(inst), p);
}
export function seqText(p: SeqDial, v: number): string {
  return isTrigParam(p) ? trigText(p, v) : lfoText(p, v);
}
/** Sa ligne d'unite ; lock : les verrous du pas montre (la duree d'un cycle de LFO lit SPD et MULT du pas s'ils y sont). */
export function seqUnit(p: SeqDial, v: number, lock?: Readonly<StepLock> | null): string {
  const stepMs = (60 / pattern.get().bpm / 4) * 1000;
  if (isTrigParam(p)) return trigUnit(p, v, stepMs);
  const inst = pattern.get().instrument;
  const { n } = lfoParts(p);
  const fx = inst ? voiceFx.of(inst) : null;
  const pick = (k: 'spd' | 'mul'): number => {
    const id = `l${n}${k}` as LfoParam;
    const lv = lock?.[id];
    return typeof lv === 'number' ? lv : fx ? lfoOf(fx, id) : lfoDefault(id);
  };
  return lfoUnit(p, v, { spd: pick('spd'), mul: Math.max(0, Math.min(LFO_MULTS.length - 1, pick('mul'))) }, stepMs);
}
/** Le potard tourne (hors P-LOCK) : le defaut de la voix dans le pattern (TRIG), son LFO (MOD) ; l'ecran le dit. */
function seqDial(p: SeqDial, v: number): void {
  resume();
  const inst = pattern.get().instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const [lo, hi] = seqRange(p);
  const x = Math.max(lo, Math.min(hi, Math.round(v)));
  if (isTrigParam(p)) pattern.setTrig(inst, p, x);
  else voiceFx.setLfo(inst, p, x);
  const now = seqValue(p);
  lcdMessage.show(`${inst} ${seqName(p)} ${seqText(p, now)}  ${seqUnit(p, now)}`, POT_UI.readoutMs, true);
  touchPage(`q:${p}` as SlotTarget, inst);
}
