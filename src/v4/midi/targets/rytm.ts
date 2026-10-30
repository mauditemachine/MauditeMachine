/** Les cibles MIDI du MM-RYTM, dans l'ordre d'aujourd'hui (le corps de coreTargets, deplace tel quel en P0). Ajouts : dans le fichier reserve de sa lane, jamais ici. */

import { LAYER_TARGET_FAMS, clearPattern, copyKey, funcDown, funcUp, muteModeKey, noKey, pasteKey, playKey, recDown, recKey, recUp, reloadKey, saveKey, stopKey, yesKey, sceneEdit01, sceneFollowId, sceneHeard01, sceneTakeId, knobBlock, knobDial, knobDialOf, dialRange, dialSteps, editToggle, bankKey, liveKey, kitDial, kitLayerDial, layerTargetSteps, layerTargetValue, muteToggle, openToggle, padHit, pageKnobCourse, patternTap, presetKnobHeld, randomPattern, rytmHome, rytmLockToggle, rytmPageKey, rytmScreenTab, rytmShowPage, runToggle, sceneDown, sceneUp, soloToggle, stepToggle, trkDown, trkUp, voiceMute, voiceSelect, fillHold } from '../../actions';
import { sceneCtl } from '../../state/sceneCtl';
import { D2_SCREENS, RYTM_SCREENS, SCREEN_TITLE, pageLabel } from '../../rytm/pages';
import { TRIG_PARAMS } from '../../audio/trig';
import { LFO_PARAMS } from '../../audio/lfo';
import { rytmPage } from '../../state/rytmPage';
import { clock } from '../../audio/clock';
import { voices as voiceState } from '../../state/voices';
import { rytmInfos } from '../../state/rytmInfos';
import { KIT_FAMILIES, KIT_IDS, KIT_LABEL, KIT_MORE, kit, kitSteps, type KitKnob } from '../../audio/kit';
import { setVoiceFx } from '../../audio/drums';
import { VOICE_PARAMS, voiceFx } from '../../audio/voicefx';
import { BANKS, BANK_SIZE, bankName } from '../../state/patterns';
import { DT_FACE, ENCODERS, PAGE_KNOB_LETTERS, RYTM_PAGE_KEYS, isVoiceEnc, type Inst } from '../../theme';
import { INSTRUMENTS, STEP_COUNT } from '../../audio/pattern';
import { seqFollow, seqPress, seqRelease, seqSetFollow, seqVoice, seqWindow } from '../seqlink';
import type { MidiTarget } from './types';
import { stageNow as getStage } from './stage';
import { dialTarget, faceHold, press, seqTarget, VOICE_LABEL, xfadeMidi } from './helpers';

export function rytmTargets(out: MidiTarget[]): void {
  // MM-RYTM
  // La rangee VOICE regle la voix choisie (comme sur la machine) ; rytm:voice:... vise une voix sans la choisir
  for (const e of ENCODERS) out.push(dialTarget(`rytm:enc:${e.id}`, 'mm808', isVoiceEnc(e.id) ? `${e.label} (SELECTED VOICE)` : e.label, e.id));
  // Les huit voix d'INSTRUMENTS (2026-10-27, la face V.4.0 n'a plus de pads au desktop) : le meme ordre, les memes ids
  const voices: readonly Inst[] = INSTRUMENTS;
  for (const inst of voices) {
    for (const p of VOICE_PARAMS) {
      // A zero au centre : TONE, et TUNE et PAN (2026-10-08), FINE et l'ENV du filtre (2026-10-09) ; TUNE a ses 49 crans
      // (le demi-ton), FINE ses 129 (le cent), le TYPE du filtre ses 3 (LP HP BP)
      const bip = p === 'tone' || p === 'tune' || p === 'pan' || p === 'fine' || p === 'fenv';
      const id = `rytm:voice:${inst}:${p}`;
      out.push({
        id,
        scope: 'mm808',
        label: `${inst} ${VOICE_LABEL[p]}`,
        kind: 'value',
        ...(p === 'tune' ? { steps: 49 } : p === 'fine' ? { steps: 129 } : p === 'ftype' ? { steps: 3 } : {}),
        // Une scene armee (2026-10-27) : la valeur de la scene, l'ecriture dans la scene ; sinon ce qu'on entend (2026-10-28 :
        // la base, ou ce qu'une scene en fait entendre, qui suit le potard : sceneFollowId)
        get: () => {
          const base = bip ? (voiceFx.of(inst)[p] + 1) / 2 : voiceFx.of(inst)[p];
          return sceneEdit01(id) ?? sceneHeard01(id, base) ?? base;
        },
        set: (v) => {
          if (sceneTakeId(id, v)) return;
          const put = (w: number): void => setVoiceFx(inst, p, bip ? w * 2 - 1 : w);
          if (!sceneFollowId(id, v, bip ? (voiceFx.of(inst)[p] + 1) / 2 : voiceFx.of(inst)[p], put)) put(v);
        },
      });
    }
  }
  // Les mutes directs (2026-10-05, le Roto en live) : 1 la voix se tait, 0 elle revient, sans le mode MUTE
  for (const inst of voices) {
    out.push({
      id: `rytm:voice:${inst}:mute`,
      scope: 'mm808',
      label: `MUTE ${inst}`,
      kind: 'value',
      steps: 2,
      get: () => (voiceState.isMuted(inst) ? 1 : 0),
      set: (v) => voiceMute(inst, v >= 0.5),
    });
  }
  // En marche ou a l'arret (un bouton a bascule : sa LED dit si la machine joue)
  out.push({
    id: 'rytm:running',
    scope: 'mm808',
    label: 'RUN (ON / OFF)',
    kind: 'value',
    steps: 2,
    get: () => (clock.running ? 1 : 0),
    set: (v) => {
      if (v >= 0.5 !== clock.running) void runToggle(getStage());
    },
  });
  // Les potards de la machine ajoutes par R3 (2026-10-08 : SWEEP du kick, TUNE DECAY TONE de la caisse claire) suivent la plaque
  // Une famille par voix (2026-10-18) : OP HAT, HI TOM et CYMBAL n'ont pas de place sur la plaque mais ont leur cible
  // (revue du 2026-10-18 : rytm:kit:oh, ht et cy, promises par la plaque et les INFOS, n'existaient pas)
  for (const k of [...KIT_IDS, ...KIT_FAMILIES.filter((f) => !KIT_IDS.includes(f)), ...KIT_MORE]) {
    // Ses crans suivent les echantillons du site (audio/samples.ts) : lus a chaque fois
    out.push({
      id: `rytm:kit:${k}`,
      scope: 'mm808',
      label: `TWEAK ${KIT_MORE.includes(k as KitKnob) ? (k === 'sweep' ? 'KICK ' : 'SNARE ') : ''}${KIT_LABEL[k]}`,
      kind: 'value',
      get steps() {
        return kitSteps(k);
      },
      get: () => kit.value(k),
      // Une scene armee (2026-10-27) : NO SCENE (un choix de son, ou un TWEAK avant P2-22), le kit ne change pas
      set: (v) => {
        if (!sceneTakeId(`rytm:kit:${k}`, v)) kitDial(k, v);
      },
    });
  }
  // Les couches de R3 (revue de R3, 2026-10-08) : chaque reglage de couche d'une famille, sans choisir sa voix. Le
  // kit de depart joue les samples de Mika (la synthese a 0) : KICK TUNE et KICK DECAY (rytm:kit:tune, decay) ne
  // reglent plus que la synthese ; le TUNE et le LEN du sample du kick ont leur cible ici (rytm:layer:bd:tune, len).
  // Toutes les familles : la MACHINE et le niveau de la synthese ; celles qui ont des samples, toute la couche SAMPLE.
  const LAYER_LABEL: Readonly<Record<string, string>> = {
    mach: 'SYN MACHINE',
    syn: 'SYN LEVEL',
    sample: 'SAMPLE',
    lev: 'SMP LEVEL',
    tune: 'SMP TUNE',
    fine: 'SMP FINE',
    start: 'SMP START',
    len: 'SMP LEN',
    rev: 'SMP REV',
  };
  for (const f of LAYER_TARGET_FAMS) {
    // Toujours toute la couche (revue du 2026-10-18) : la liste est construite une fois, un sample depose ensuite dans
    // une famille vide n'aurait pas eu ses cibles avant un rechargement ; sans sample, leurs crans valent 0
    const params = ['mach', 'syn', 'sample', 'lev', 'tune', 'fine', 'start', 'len', 'rev'] as const;
    for (const lp of params) {
      out.push({
        id: `rytm:layer:${f}:${lp}`,
        scope: 'mm808',
        label: `${KIT_LABEL[f]} ${LAYER_LABEL[lp]}`,
        kind: 'value',
        get steps() {
          const n = layerTargetSteps(f, lp);
          return n > 1 ? n : 0;
        },
        get: () => layerTargetValue(f, lp),
        set: (v) => {
          if (!sceneTakeId(`rytm:layer:${f}:${lp}`, v)) kitLayerDial(f, lp, v);
        },
      });
    }
  }
  // Les potards de page (2026-10-08) : relatifs a la page, leur course, leurs crans et leur nom suivent la page. Depuis le
  // 2026-10-27 (les potards de la face suivent la page) : le potard k du desktop, ce que tournera le potard k du boitier ;
  // sur une case couverte par un bloc haut ou un dessin large, ce bloc (comme le potard de la face), ailleurs inchange
  PAGE_KNOB_LETTERS.forEach((letter, k) => {
    out.push({
      id: `rytm:knob:${k + 1}`,
      scope: 'mm808',
      label: `KNOB ${letter} (PAGE)`,
      kind: 'value',
      follows: 'page',
      get steps() {
        return dialSteps(knobDialOf(k));
      },
      // Un bloc vide, ou rien a regler (pas de voix choisie, pas de pas choisi) : 0, comme son repere sur
      // la face (2026-10-08, revue de R1 : VOL sans voix renvoyait 102, une valeur que l'ecran ne montrait pas)
      // Les presets du desktop ouverts (2026-10-27) : la position du controleur, pas la page cachee (le moteur ne repart pas)
      get: () => {
        const held = presetKnobHeld(k);
        if (held !== null) return held;
        const b = knobBlock(k);
        return b === null ? 0 : pageKnobCourse(b);
      },
      set: (v) => {
        const [lo, hi] = dialRange(knobDialOf(k));
        knobDial(k, lo + v * (hi - lo), 'midi');
      },
    });
  });
  // Les quatre touches de page (2026-10-09 : VOICE FLTR ENV FX) : la page, la touche allumee encore son onglet suivant ou HOME ;
  // au desktop depuis V.5.0 leur nom de la face (SRC, AMP) et FUNC + la touche (MIDI rytm:func tenue)
  for (const pk of RYTM_PAGE_KEYS) out.push(press(`rytm:page:${pk.id}`, 'mm808', `PAGE ${pageLabel(pk.id)}`, () => rytmPageKey(pk.id, getStage())));
  // Les anciennes pages (jusqu'au 2026-10-09) : leurs assignations retenues ouvrent la page d'aujourd'hui (TRIG SRC SMPL : VOICE ; AMP : ENV) ;
  // au desktop depuis V.5.0, rytm:page:trig ouvre la vraie page TRIG, SRC et AMP sont les noms de VOICE et ENV
  const OLD_PAGES = DT_FACE ? ([['trig', ''], ['src', ''], ['smpl', 'SRC'], ['amp', '']] as const) : ([['trig', 'VOICE'], ['src', 'VOICE'], ['smpl', 'VOICE'], ['amp', 'ENV']] as const);
  // rytm:page:trig au desktop (la revue de D1, K2) : la touche TRIG elle-meme (FUNC + TRIG = TEMPO, TRIG puis YES = RANDOM,
  // TRIG encore = HOME), comme les autres touches de page ; le telephone garde l'alias de VOICE
  for (const [old, now] of OLD_PAGES) out.push(press(`rytm:page:${old}`, 'mm808', `PAGE ${old.toUpperCase()}${now ? ` (NOW ${now})` : ''}`, () => (DT_FACE && old === 'trig' ? rytmPageKey('trig', getStage()) : rytmShowPage(old))));
  // Un ecran precis (2026-10-09) : VOICE, VOICE SYNTH, FLTR, ENV, VOICE FX, GLOBAL FX (les onglets de l'en-tete)
  // Ceux de V.5.1 (TRIG 2/2, MOD 2/2) viennent a la fin de la liste : aucun id d'avant ne bouge
  for (const sc of RYTM_SCREENS) if (!D2_SCREENS.includes(sc)) out.push(press(`rytm:screen:${sc}`, 'mm808', `SCREEN ${SCREEN_TITLE[sc]}`, () => rytmScreenTab(sc)));
  out.push({
    id: 'rytm:page',
    scope: 'mm808',
    label: 'PAGE (VOICE TO FX)',
    kind: 'value',
    steps: RYTM_PAGE_KEYS.length,
    get: () => Math.max(0, RYTM_PAGE_KEYS.findIndex((p) => p.id === rytmPage.get().page)) / (RYTM_PAGE_KEYS.length - 1),
    set: (v) => rytmShowPage(RYTM_PAGE_KEYS[Math.max(0, Math.min(RYTM_PAGE_KEYS.length - 1, Math.round(v * (RYTM_PAGE_KEYS.length - 1))))].id),
  });
  out.push(press('rytm:home', 'mm808', 'HOME / PAGE SCREEN', () => rytmHome()));
  for (const inst of voices) out.push(press(`rytm:pad:${inst}`, 'mm808', `PAD ${inst}`, () => padHit(inst, getStage())));
  for (let i = 0; i < STEP_COUNT; i += 1) out.push(press(`rytm:step:${i}`, 'mm808', `STEP ${i + 1}`, () => void stepToggle(i, getStage())));
  // Le LOCK (2026-10-08, les parameter locks) : un bouton par pas (encore : hors LOCK), et celui du pas choisi
  for (let i = 0; i < STEP_COUNT; i += 1) out.push(press(`rytm:lock:${i}`, 'mm808', `LOCK STEP ${i + 1}`, () => rytmLockToggle(i)));
  out.push(press('rytm:lock', 'mm808', 'LOCK (SELECTED STEP)', () => rytmLockToggle()));
  out.push(press('rytm:run', 'mm808', 'RUN/STOP', () => void runToggle(getStage())));
  out.push(press('rytm:clear', 'mm808', 'CLEAR', () => clearPattern(getStage())));
  out.push(press('rytm:random', 'mm808', 'RANDOM', () => randomPattern(getStage())));
  out.push(press('rytm:mute', 'mm808', 'MUTE', () => void muteToggle(getStage())));
  out.push(press('rytm:solo', 'mm808', 'SOLO', () => void soloToggle(getStage())));
  out.push(press('rytm:edit', 'mm808', 'EDIT', () => editToggle('mm808', getStage())));
  out.push(press('rytm:open', 'mm808', 'OPEN', () => void openToggle(getStage(), 'mm808')));
  // La touche i de l'ecran (R4, 2026-10-08) : INFOS, l'aide au survol
  out.push(press('rytm:infos', 'mm808', 'INFOS (HELP ON HOVER)', () => void rytmInfos.toggle()));
  // Les seize patterns (2026-10-05, state/patterns.ts) : comme un step en EDIT (d'autres dans les deux secondes : la chaine).
  // V.5.2 : le pattern k de la banque affichee (rytm:bank:<b>), comme les touches de trig de la Digitakt en mode PTN ; la
  // banque A au depart, les memes ids
  for (let i = 0; i < BANK_SIZE; i += 1) out.push(press(`rytm:ptn:${i}`, 'mm808', `PATTERN ${String(i + 1).padStart(2, '0')} (OF THE SHOWN BANK)`, () => patternTap(i, getStage())));
  // Le Roto en sequenceur (2026-10-09, le setup RSEQ, midi/seqlink.ts) : les huit pas d'une fenetre (taper, tenir,
  // tourner : appui et lacher), la fenetre 1-8 / 9-16, STEP FOLLOW (une bascule), la voix des pas (sans la jouer)
  for (let b = 0; b < 8; b += 1) {
    out.push({ id: `rytm:seq:${b + 1}`, scope: 'mm808', label: `SEQ STEP ${b + 1}|${b + 9} (TAP, HOLD + TURN)`, kind: 'hold', down: () => seqPress('rytm', b), up: () => seqRelease('rytm', b, getStage()) });
  }
  out.push(press('rytm:seq:window', 'mm808', 'SEQ STEPS 1-8 / 9-16', () => seqWindow('rytm')));
  out.push({ id: 'rytm:seq:follow', scope: 'mm808', label: 'SEQ STEP FOLLOW (THE STEPS FOLLOW THE PLAYHEAD)', kind: 'value', steps: 2, get: () => (seqFollow('rytm') ? 1 : 0), set: (v) => seqSetFollow('rytm', v >= 0.5) });
  for (const inst of voices) out.push(press(`rytm:seq:voice:${inst}`, 'mm808', `SEQ VOICE ${inst} (SELECT, SILENT)`, () => seqVoice(inst)));
  // La phase 3 (2026-10-27, la spec de Mika ; le boitier MMHW v2 : TRK note 60, SCENE A 79, SCENE B 80, crossfader CC 28) :
  // ajoutees a la fin, aucun id d'avant ne change. TRK et les scenes passent par la meme machine a tenir ou taper que leur
  // touche (state/holdLatch.ts, la source 'midi') ; le crossfader par xfadeSet, son geste ouvert et ferme ici
  out.push(faceHold('rytm:trk', 'TRK (HOLD + STEPS 1-8: PICK A VOICE)', 'trk', () => trkDown('midi'), () => trkUp('midi')));
  out.push(faceHold('rytm:scene:a', 'SCENE A (HOLD OR TAP)', 'scene-a', () => sceneDown('a', 'midi'), () => sceneUp('a', 'midi')));
  out.push(faceHold('rytm:scene:b', 'SCENE B (HOLD OR TAP)', 'scene-b', () => sceneDown('b', 'midi'), () => sceneUp('b', 'midi')));
  out.push({ id: 'rytm:xfade', scope: 'mm808', label: 'CROSSFADER (SCENE A TO B)', kind: 'value', get: () => sceneCtl.x(), set: (v) => xfadeMidi(v) });
  for (const inst of voices) out.push(press(`rytm:voice:select:${inst}`, 'mm808', `VOICE ${inst} (SELECT, SILENT)`, () => voiceSelect(inst, 'midi')));
  // V.5.0 (2026-10-29, la face facon Digitakt du desktop, docs/v4/digitakt-d1-spec.md) : ajoutees a la fin, aucun id d'avant
  // ne change ni ne bouge ; rytm:run, rytm:clear, rytm:random, rytm:mute, rytm:solo, rytm:edit et rytm:open gardent leur
  // effet. FUNC passe par la meme machine que sa touche (state/func.ts, la source 'midi') : tenue, puis une autre cible
  out.push(faceHold('rytm:func', 'FUNC (HOLD + A KEY: ITS ORANGE FUNCTION)', 'func', () => funcDown('midi'), () => funcUp('midi')));
  // ● REC (V.5.3, la revue de D3b R6) : tenue comme W et la face ; tenue + rytm:play : LIVE REC (FUNC + REC, COPY, la lit)
  out.push({ id: 'rytm:rec', scope: 'mm808', label: 'REC (WRITE THE STEPS, ON / OFF; HOLD + PLAY: LIVE REC)', kind: 'hold', down: () => { recKey(getStage()); recDown('midi'); }, up: () => void recUp('midi') });
  out.push(press('rytm:play', 'mm808', 'PLAY (PAUSE, RESUME)', () => void playKey(getStage())));
  out.push(press('rytm:stop', 'mm808', 'STOP (TWICE: CUT THE TAILS)', () => stopKey(getStage())));
  out.push(press('rytm:yes', 'mm808', 'YES (CONFIRM, A PAGE THEN YES: RANDOM)', () => yesKey(getStage())));
  out.push(press('rytm:no', 'mm808', 'NO (BACK, A PAGE THEN NO: RELOAD IT)', () => void noKey(getStage())));
  out.push(press('rytm:page:mod', 'mm808', 'PAGE MOD', () => rytmPageKey('mod', getStage())));
  out.push(press('rytm:mutemode', 'mm808', 'MUTE MODE (GLOBAL, PATTERN, OFF)', () => muteModeKey()));
  out.push(press('rytm:save', 'mm808', 'SAVE (THE SAVE POINT)', () => saveKey()));
  out.push(press('rytm:reload', 'mm808', 'RELOAD (BACK TO THE SAVE POINT)', () => reloadKey()));
  out.push(press('rytm:copy', 'mm808', 'COPY (THE PATTERN, WITH REC THE VOICE ROW)', () => copyKey()));
  out.push(press('rytm:paste', 'mm808', 'PASTE', () => pasteKey()));
  // V.5.1 (2026-10-29, l'etape D2, docs/v4/digitakt-d2-spec.md section 4) : ajoutees a la fin, aucun id d'avant ne change.
  // Les reglages de trig par defaut de chaque voix (ceux du pattern) et ses deux LFO (ses reglages de voix), sans la choisir ;
  // hors des scenes en D2 (rytm/sceneParams.ts : noscene)
  for (const inst of voices) {
    for (const p of TRIG_PARAMS) out.push(seqTarget(inst, p));
    for (const p of LFO_PARAMS) out.push(seqTarget(inst, p));
  }
  // FILL tenu (YES tenu sur la face, le boitier : une note tenue)
  out.push(faceHold('rytm:fill', 'FILL (HOLD: THE FILL CONDITIONS PLAY)', 'yes', () => fillHold(true), () => fillHold(false)));
  out.push(press('rytm:screen:trig2', 'mm808', `SCREEN ${SCREEN_TITLE.trig2}`, () => rytmScreenTab('trig2')));
  out.push(press('rytm:screen:mod1', 'mm808', `SCREEN ${SCREEN_TITLE.mod} (LFO 1)`, () => rytmScreenTab('mod')));
  out.push(press('rytm:screen:mod2', 'mm808', `SCREEN ${SCREEN_TITLE.mod2} (LFO 2)`, () => rytmScreenTab('mod2')));
  // V.5.2 (2026-10-30, docs/v4/digitakt-d3a-spec.md section 1) : ajoutees a la fin, aucun id d'avant ne change ni ne bouge.
  // Les banques A a H : afficher la banque b (rytm:ptn:<k> y choisit ensuite le pattern)
  for (let b = 0; b < BANKS; b += 1) out.push(press(`rytm:bank:${b}`, 'mm808', `BANK ${bankName(b)} (SHOW ITS PATTERNS)`, () => bankKey(b, getStage())));
  // V.5.3 (2026-10-30, docs/v4/digitakt-d3b-spec.md) : ajoutee a la fin. LIVE REC : un appui y entre (arme a l'arret), un autre en sort
  out.push(press('rytm:liverec', 'mm808', 'LIVE REC (ON / OFF)', () => liveKey()));
}
