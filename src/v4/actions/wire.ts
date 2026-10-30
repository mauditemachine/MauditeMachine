/**
 * Les actions du MM-RYTM : les branchements faits au chargement (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0,
 * critique C4) : les abonnements et les resolveurs que actions.ts posait a son evaluation, dans leur ordre d'avant.
 * Importe EN DERNIER par le baril (apres tous les modules : aucune const lue en zone morte).
 */

import { KIT_MODEL_LABEL, kit } from '../audio/kit';
import { isLockTrig } from '../audio/locks';
import { onSampleFailed, onSampleLoaded, sampleByKey, samplesChanged } from '../audio/samples';
import { pattern, velocity } from '../audio/pattern';
import { lcdMessage } from '../state/lcdMessage';
import { editor } from '../state/editor';
import { patterns } from '../state/patterns';
import { func } from '../state/func';
import { dtFace } from '../state/dtFace';
import { rytmLock } from '../state/rytmLock';
import { trk } from '../state/trk';
import { sceneCtl } from '../state/sceneCtl';
import { setCtlAllResolver, setKnobResolver, setLiveResolver, setStepResolver } from '../rytm/infoIds';
import { DT_FACE } from '../theme';
import { st } from './state';
import { ctlAllBefore, ctlAllEnd, ctlAllKeyOf, ctlAllOn } from './ctlall';
import { FAIL_WORD, voiceSoundCache } from './internal/kit';
import { FAM_TAG, lockSampleCache, lockSoundCache } from './internal/locks';
import { failShown, kitFamiliesOf } from './internal/browser';
import { FUNC_LOCKED, funcSay } from './internal/face';
import { knobBlock } from './dials';
import { pageTarget } from './kit';
import { liveOn } from './live';

// TRK eteinte (lachee, fermee, Echap, une autre machine) : son aide s'en va avec elle ; CONTROL ALL est fait (V.5.2)
trk.subscribe(() => {
  if (trk.engaged()) return;
  ctlAllEnd();
  // Eteinte : la double tape repart de zero a la prochaine
  st.trkLast = null;
  if (!st.trkLcd) return;
  lcdMessage.hide(st.trkLcd);
  st.trkLcd = '';
});
// Le P-LOCK garde (un pas tenu lache sans tourner, L, le MIDI) : une scene armee se desarme, gardee ou tenue (2026-10-27,
// revue B3 : une scene tenue restait armee a cote du P-LOCK garde, un cran de molette ecrivait 8 valeurs dans la scene ;
// le lacher de la touche tenue est ensuite ignore, holdLatch eteinte)
rytmLock.subscribe(() => {
  const lk = rytmLock.get();
  if (lk.step >= 0 && lk.latched && sceneCtl.get().armed) sceneCtl.cancel();
});

// La grille fermee (Echap, une autre machine, PTN) : la vue BANK s'en va avec elle
editor.subscribe(() => {
  if (editor.get() !== 'mm808' && dtFace.bank()) {
    dtFace.setBank(false);
    st.bankOverGrid = false;
  }
});

// Les cartes INFOS d'un potard de la face (rytm/infoIds.ts, pur) : le bloc qu'il tourne sur l'ecran affiche
setKnobResolver(knobBlock);
// La carte d'un pas (V.5.1) : un lock trig de la voix choisie a la sienne ; la vue BANK (V.5.2), la sienne
setStepResolver((i) => {
  if (DT_FACE && dtFace.bank() && editor.get() === 'mm808') return 'bank';
  const p = pattern.get();
  const inst = p.instrument;
  return inst && velocity(p.steps, inst, i) === 0 && isLockTrig(p.locks, inst, i) ? 'locktrig' : null;
});

// La carte d'un potard pendant TRK : CONTROL ALL, seulement s'il y regle un reglage des huit voix (R12)
setCtlAllResolver((k) => {
  if (!ctlAllOn()) return false;
  const b = knobBlock(k);
  const t = b === null ? null : pageTarget(b);
  return t !== null && ctlAllKeyOf(t) !== null;
});

// Un autre pattern pendant le geste (la chaine qui avance, un pattern pose) : CONTROL ALL se termine (R3, R7)
patterns.subscribe(() => {
  if (ctlAllBefore.size > 0 && patterns.get().cur !== st.ctlAllSlot) ctlAllEnd();
});
// Un sample de Mika ajoute ou retire de ce navigateur (audio/usersamples.ts) : les listes gardees ici se refont
samplesChanged.subscribe(() => {
  voiceSoundCache.clear();
  lockSoundCache.clear();
  lockSampleCache.clear();
});
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
// FUNC gardee (deux tapes) : l'ecran le dit ; eteinte, son aide s'en va avec elle
func.subscribe(() => {
  const m = func.get().mode;
  if (m === 'locked' && st.funcLcd !== FUNC_LOCKED) {
    funcSay(FUNC_LOCKED);
    return;
  }
  if (m !== 'off' || !st.funcLcd) return;
  lcdMessage.hide(st.funcLcd);
  st.funcLcd = '';
});

// La carte de ● en LIVE REC : LIVE REC
setLiveResolver(() => liveOn());
