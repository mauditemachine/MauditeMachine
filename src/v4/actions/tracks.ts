/**
 * Les actions du MM-RYTM : les voix et TRK (padHit, mute, solo, select, trkStep, trkPick, trkDown, trkUp, voiceSelect). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/tracks.ts.
 */

import { clock } from '../audio/clock';
import { resume, trigger } from '../audio/drums';
import { INSTRUMENTS, VEL_GAIN, pattern } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { lcdMessage } from '../state/lcdMessage';
import { lcdSamples } from '../state/lcdSamples';
import { dtFace } from '../state/dtFace';
import { rytmPage } from '../state/rytmPage';
import { type CtlSrc } from '../state/ctl';
import { trk } from '../state/trk';
import { voices } from '../state/voices';
import { DT_FACE, PAD_DOUBLE_TAP_MS, type Inst } from '../theme';
import { st } from './state';
import { ctlAllEnd } from './ctlall';
import { gesture } from './shared';
import { muteVoice, selectVoice, soloVoice, TRK_HINT_MS } from './internal/tracks';
import { funcTake } from './internal/face';
import { liveRunning, liveSelect, liveVel } from './internal/live';
import { funcDrop, muteModeKey } from './face';
import { liveHit } from './live';

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
  // LIVE REC en lecture (V.5.3) : le pad joue sa voix tout de suite, s'ecrit au pas le plus proche et la choisit (une voix
  // coupee s'ecrit sans un son) ; le pas qui la joue deja a ce passage la joue seul (la revue de D3b R10 : pas de flam).
  // TRK engagee : le pad choisit sa voix, il n'ecrit rien (la revue de D3b R4, comme hors LIVE REC)
  if (liveRunning() && !trk.engaged()) {
    const n = liveVel();
    const r = liveHit(inst, n);
    if (r !== 'quiet' && !voices.isMuted(inst) && !(DT_FACE && pattern.pmuted(inst))) trigger(inst, undefined, false, undefined, VEL_GAIN[n] ?? 1);
    liveSelect(inst);
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
 * TRK (2026-10-27, la phase 2, Mika : "comme la DIGITAKT") : l'aide a l'ecran tant que la touche est engagee (tenue,
 * gardee ou en fermeture), eteinte avec elle.
 */
export const TRK_HINT = 'TRK: PICK A VOICE, STEPS 1-8';
const trkSay = (text: string): void => {
  st.trkLcd = text;
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
  if (trk.get().mode === 'closing' && !(st.trkLast && st.trkLast.i === i && t - st.trkLast.t <= PAD_DOUBLE_TAP_MS)) {
    trk.cancel();
    return false;
  }
  const inst = Number.isInteger(i) && i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst) return true;
  stage?.pressStep(i);
  // Deux tapes sur le meme pas en moins de PAD_DOUBLE_TAP_MS (2026-10-27, la regle des pads du 2026-10-10 passee a TRK) :
  // la voix se coupe ou revient ; hors des modes SOLO et MUTE (leur tape fait deja autre chose)
  const v = voices.get();
  if (!v.soloMode && !v.muteMode && st.trkLast && st.trkLast.i === i && t - st.trkLast.t <= PAD_DOUBLE_TAP_MS) {
    st.trkLast = null;
    trkMute(inst, t);
    return true;
  }
  st.trkLast = { i, t };
  trkPick(inst, t);
  return true;
}

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
  st.trkLast = null;
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

/** Phase 3 (rytm:voice:select:<V>, le materiel) : le meme choix muet, sans TRK. */
export function voiceSelect(inst: Inst, src: CtlSrc = 'ui'): void {
  void src;
  resume();
  if (pattern.get().instrument !== inst) pattern.select(inst);
  if (lcdSamples.isOpen()) lcdSamples.touch();
  else lcdMessage.show(`TRK ${inst}`);
}
