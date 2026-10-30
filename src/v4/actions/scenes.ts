/**
 * Les actions du MM-RYTM : les scenes A et B et le crossfader (armement, edition, ce qu'on entend, sceneTake, xfadeSet). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/scenes.ts.
 */

import { resume } from '../audio/drums';
import { pattern } from '../audio/pattern';
import { lcdMessage } from '../state/lcdMessage';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { type CtlSrc } from '../state/ctl';
import { sceneCtl } from '../state/sceneCtl';
import { morph } from '../audio/morph';
import { NO_SCENES, anyScenes, morph01, sceneCount, type SceneId } from '../rytm/sceneData';
import { bindingOf, from01, sceneRole, to01, voiceRowId, type SceneBinding } from '../rytm/sceneParams';
import { v127Text } from '../rytm/values';
import { LCD_NO_VOICE, POT_UI, XFADE_UI, encLabel, isVoiceEnc, type EncId } from '../theme';
import { dialName, SCENE_SHORT, SCENE_WORD, sceneNative } from './internal/scenes';
import { voyId } from './internal/kit';
import { mixerInst } from './internal/mixer';
import { anyDial, anyDialValue, dialValueText, pageKnobLive } from './anyDial';
import { type DialId, kitIdOf, layerIdOf, pageKnobOf, pageTarget, soundFamily } from './kit';
import { lockMode } from './locks';
import { funcDrop } from './face';
import { seqDialOf } from './mixer';

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
