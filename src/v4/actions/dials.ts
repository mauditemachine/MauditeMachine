/**
 * Les actions du MM-RYTM : les potards de l'ecran et de la face (dial, globalDial, knobDial, dialValue, dialReset, pageDial). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/dials.ts.
 */

import { mix, resume, setChorus, setDelay, setDrive, setLevel, setReverb, setStretch, setSwing, setVoiceFx } from '../audio/drums';
import { VOICE_FX_DEFAULT, voiceFx } from '../audio/voicefx';
import { kit } from '../audio/kit';
import { BPM, DELAY_DIVS, fxSnap, isFxSetting, pattern } from '../audio/pattern';
import { lcdMessage } from '../state/lcdMessage';
import { lcdMix } from '../state/lcdMix';
import { lcdSamples } from '../state/lcdSamples';
import { editor } from '../state/editor';
import { presetMode } from '../state/presetMode';
import { rytmPage } from '../state/rytmPage';
import { faceTouch, type CtlSrc } from '../state/ctl';
import { sceneCtl } from '../state/sceneCtl';
import { morph } from '../audio/morph';
import { NO_SCENES } from '../rytm/sceneData';
import { bindingOf, from01 } from '../rytm/sceneParams';
import { FACE_PAGES, faceBlockOf, fxDetailOf, pageSlots, screensOf } from '../rytm/pages';
import { FACE_FOLLOWS_PAGE, GLOBAL_ENCODERS, LCD_NO_VOICE, POT_UI, isVoiceEnc, type EncId, type Inst } from '../theme';
import { st } from './state';
import { sceneHideSay } from './internal/scenes';
import { type ContEnc, presetAbs, readout, touchPage, voiceParam } from './internal/dials';
import { soundDial } from './internal/kit';
import { sceneIdOfDial, sceneTake } from './scenes';
import { anyDial, anyDialReset, dialRange } from './anyDial';
import { curScreen, type DialId, soundFamily } from './kit';
import { lockMode, pageKnobReset } from './locks';
import { funcDrop } from './face';
import { presetTurn, presetTurns } from './presets';

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
 * La voix que regle un potard : celle du pad selectionne pour la rangee
 * VOICE (VOLUME, TONE, STRETCH, DIST, CHORUS, DELAY, REVERB) ; null pour
 * TEMPO, MASTER et la rangee GLOBAL, qui reglent tout le pattern.
 */
export function dialTarget(id: EncId): Inst | null {
  return isVoiceEnc(id) ? pattern.get().instrument : null;
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

/**
 * Le mode presets du desktop (2026-10-27) : une valeur absolue (MIDI, le potard motorise) devient des crans, un tous les
 * 1/PRESET_MIDI_STEPS de la course depuis la valeur d'avant du meme potard (la premiere ne fait que se poser).
 */
const PRESET_MIDI_STEPS = 24;
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
  // LIVE REC (V.5.3, la revue de D3b R2 R11) : le potard de la face qui tourne, pour que seul lui continue d'ecrire
  st.liveFace = k;
  try {
    anyDial(knobDialOf(k), v);
  } finally {
    st.liveFace = -1;
  }
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
