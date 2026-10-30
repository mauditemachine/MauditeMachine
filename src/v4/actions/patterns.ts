/**
 * Les actions du MM-RYTM : les patterns et les banques (chaine, patternTap, bankKey, clearPattern, randomPattern). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/patterns.ts.
 */

import { clock } from '../audio/clock';
import { resume, setStretch } from '../audio/drums';
import { voiceFx } from '../audio/voicefx';
import { KIT_DEFAULT, KIT_FAMILIES, LAYER_DEFAULT, kit } from '../audio/kit';
import { COLOR_VOICES, randomBeat, randomColors, type BeatStyle } from '../audio/beats';
import { INSTRUMENTS, pattern } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { lcdMessage } from '../state/lcdMessage';
import { editor } from '../state/editor';
import { BANKS, bankName, bankOf, patterns, slotName } from '../state/patterns';
import { undo } from '../state/undo';
import { dtFace } from '../state/dtFace';
import { rytmLock } from '../state/rytmLock';
import { sceneCtl } from '../state/sceneCtl';
import { NO_SCENES, anyScenes } from '../rytm/sceneData';
import { DT_FACE } from '../theme';
import { st } from './state';
import { SCENE_WORD } from './internal/scenes';
import { randomVoiceSounds } from './internal/patterns';
import { rytmLockClear } from './locks';

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
  st.bankOverGrid = false;
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
