/**
 * Le MM-BASS en 3D (2026-10-07) : un bloc de la taille du MM-RYTM, fait des
 * pieces du MM-DECKS (dj/body.ts le coin, le dessus brosse, les pieds, la
 * connectique derriere ; le dessus a la forme de celui du MM-RYTM, coins
 * arrondis, sans vis ; dj/controls.ts les potards et les touches
 * en caoutchouc a LED ; dj/silk.ts la serigraphie), dispose d'apres
 * bass/theme.ts :
 * - l'ecran (bass/screen.ts) ;
 * - dix touches (RUN en or quand la basse joue, ACCENT et SLIDE allumes
 *   quand le pas choisi les a) ;
 * - seize pas : orange une note (plus vif accentuee), pale une liaison, or le
 *   pas qui joue, le pas choisi plus clair ; en EDIT (2026-10-07) les seize
 *   patterns : le courant vif, la chaine a demi, celui qui attend en or, un
 *   plein a peine ;
 * - seize boutons LOCK au-dessus des pas (2026-10-07) : orange pale si le pas
 *   a des verrous, or celui qu'on regle ;
 * - l'ecran se touche pour les presets (state/presetMode.ts, comme ceux du
 *   MM-RYTM et du MM-ARP) ; depuis la revue du 2026-10-08 son en-tete
 *   seulement, ses huit blocs repondent comme leurs encodeurs ;
 * Tout dans le repere top (le dessus incline), x = 0 au centre du bloc.
 *
 * La refonte facon Monark et Elektron (2026-10-08, Mika : "MM-BASS est un
 * peu complexe ; quelque chose d'intuitif, pour qu'on ne cherche pas les
 * choses ; un bouton OPEN ; un bouton EDIT, je n'en vois pas") : EDIT et
 * OPEN en haut a droite, noms et LED orange ; le capot (top) : la dalle,
 * l'ecran, toutes les commandes, pose sur le coin descendu de son epaisseur ;
 * OPEN le souleve (scene/explode.ts, bassExplode) ; dans le bac (inner, le
 * repere du fond), la carte du MM-RYTM sort, sa plaque TWEAKS
 * (bass/tweaks.ts) porte les reglages fins, INFOS et CLOSE.
 *
 * La machine Elektron (le meme jour, Mika : "il faudrait vraiment faire
 * comme un principe de machine elektron ; les valeurs des knobs sont a
 * l'ecran, pas sur les encodeurs, de 0 a 127 ; je veux un petit bouton i
 * dans l'ecran") : les onze potards du son et leurs LED de verrou partent ;
 * a leur place l'ecran deux fois plus grand et huit encodeurs sans fin A a
 * H (noirs, moletes, un court trait : ils tournent avec le geste, la valeur
 * est a l'ecran), les quatre touches de page dessous (la LED de la page
 * allumee ; en LOCK, a demi celles qui portent un verrou sur le pas), la
 * touche "i" dessinee dans le coin de l'ecran (bass-key-i), le GENERATOR
 * (STYLE, DENSITY, GEN, MUTATE) sous EDIT et OPEN. Le pas en LOCK clignote,
 * son bouton LOCK aussi ; la rangee des LOCK porte son nom (un filet LOCK,
 * la revue).
 *
 * Au telephone, plus d'encodeurs (2026-10-09, Mika : "en mobile c'est mieux
 * si tu ne mets pas d'encodeurs ; on change dans l'ecran directement, et en
 * dessous de l'ecran on retrouve les boutons ; forcement donne-moi un ecran
 * plus grand") : ni capuchons, ni lettres, ni zones bass-enc-* ; l'ecran
 * prend leur place (bass/theme.ts), ses huit blocs (bass-blk-1 a 8) sont les
 * commandes, cernes tant qu'un doigt les tient (holdBlock) ; les touches de
 * page juste dessous, leur zone etendue a leur nom (BASS_PAGE_HIT). La revue
 * du meme jour : les onglets de l'en-tete tournent leur page (bass-tab-*), le
 * pattern seul ouvre les presets, le reste de l'en-tete ne fait rien ; ces
 * zones suivent ce que l'ecran dessine (syncHead).
 *
 * L'etape 2 (2026-10-09, Mika : "en desktop tu les laisses, mais ils ne
 * servent qu'a faire les modifs des FX globaux de la machine ; les FX des
 * parameters lock se font dans l'ecran ; dans EDIT, editer la hauteur des
 * notes a la souris sur l'ecran") :
 * - les huit encodeurs tiennent pour de bon les FX globaux (bass/pages.ts
 *   BASS_FX_KNOBS) : leur nom serigraphie au-dessus (DRIVE, DELAY...), le
 *   crochet GLOBAL FX ; ils tournent avec leur reglage global ; leur MIDI
 *   LEARN donne bass:global:<id> (bass/midi.ts) ;
 * - l'ecran se regle a la souris aussi : le bloc survole se cerne a peine,
 *   le curseur dit qu'on le glisse (cursor) ; la pastille P-LOCK 05 de
 *   l'en-tete (bass-lcd-plock) sort du P-LOCK ; la ligne du titre est un
 *   verre qui ne fait rien (bass-lcd-title) ;
 * - EDIT : le rouleau de l'ecran (bass-roll) ou l'on glisse les notes, pose
 *   ou l'ecran le dessine (syncRoll).
 *
 * Les onglets (2026-10-09, le moteur MONARK) : les puces de l'en-tete
 * (bass-scr-<ecran> : VOICE MAIN, OSC, MIX ; FILTER MAIN, CONTOUR), posees ou
 * l'ecran les dessine (desktop : sur la ligne du titre, un cadre au survol ;
 * telephone : dans l'en-tete, toute sa hauteur, 44 px au doigt, a cote de la
 * pastille de la page qui est son onglet bass-tab-<page>, les autres pages
 * passent par leurs touches sous l'ecran) ; les LED des touches de page
 * comptent les verrous de tous les onglets de leur page.
 *
 * La face simple (2026-10-09, le soir, Mika : "toute cette partie la est
 * difficile a utiliser sans visibilite, agrandis l'ecran jusqu'aux steps,
 * mets les boutons ACCENT SLIDE NOTE- NOTE+ OCT- OCT+ dans l'ecran, mets
 * RUN CLEAR GEN et rajoute un bouton PRESET a droite ; MUTATE je comprends
 * pas vraiment, enleve ca") : la rangee de jeu s'en va. Les six touches du
 * pas sont des zones de l'ecran (bass-key-accent... : MIDI LEARN et le
 * clavier les retrouvent, l'ecran les dessine pressees) ; PRESET
 * (bass-key-preset) ouvre et ferme les presets, sa LED allumee tant qu'ils
 * sont ouverts ; MUTATE n'a plus de touche (ses cibles MIDI restent) ; un
 * crochet CONTOUR au-dessus de la seconde rangee d'encodeurs (desktop).
 */

import { BoxGeometry, BufferGeometry, CylinderGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { reserve } from '../audio/sched';
import type { HotspotDef, Occluder } from '../scene/hit';
import { potAngle } from '../scene/encoders';
import { Explode, type ExplodeCfg, type ExplodeInfo } from '../scene/explode';
import { withRubberLed } from '../scene/materials';
import { Pcb } from '../scene/pcb';
import { makeBrushTexture, whenFonts } from '../scene/silk';
import { bassExplode } from '../state/explode';
import { APPEARANCE, PCB_TURN, PORTRAIT } from '../theme';
import { pattern } from '../audio/pattern';
import { editor } from '../state/editor';
import { presetMode, type PresetKey } from '../state/presetMode';
import { presets } from '../state/presets';
import { TOP_M, bezel, dc, partDj, power, rca, roundSlab, usb, wedge } from '../dj/body';
import { DJ_GLOW, keyGeometry, knobGeometry } from '../dj/controls';
import { DjSilk, headTexts, type Bracket, type Line, type Text } from '../dj/silk';
import { DJ_BEZEL, DJ_BODY, DJ_KEY, DJ_KNOB, DJ_TILT, DJ_TOP_Y, DJ_UNIT } from '../dj/theme';
import { bassKnobValue, bassTakeName, noteName } from './actions';
import { genCellsOf } from './diagrams';
import { bassLine, styleName } from './line';
import { BASS_FX_KNOBS } from './pages';
import { BASS_SLOTS, bassPatterns } from './patterns';
import { BASS_FACE_KNOBS as BASS_KNOBS, BASS_PLATE_KNOBS, bassKnob, bassParams, type BassKnobId } from './params';
import { BASS_SCREENS, BASS_SCREEN_SLOTS, ENC_LETTERS, bassPage, pageIds, type BassPageId, type BassScreenId } from './pages';
import { bassEditModel, bassKeysModel, bassPageModel, type BassEditModel, type BassKeysModel, type BassPageModel } from './pageView';
import { BassTweaks } from './tweaks';
import { bassInfos } from '../state/bassInfos';
import { BassScreen, type BassScreenView } from './screen';
import { bassSeq, midiOf } from './seq';
import { BASS_STEPS, bassState, isLockable } from './state';
import {
  BASS,
  BASS_D,
  BASS_ENC_N,
  BASS_ENC_S,
  BASS_EXPLODE,
  BASS_KEYS,
  BASS_KNOB_PLACES,
  BASS_LID,
  BASS_LOCK_KEYS,
  BASS_LOCK_LEGEND_DZ,
  BASS_PAGE_HIT,
  BASS_PAGE_KEYS,
  BASS_PCB_Y,
  BASS_SCREEN_KEY_KINDS,
  BASS_SECTIONS,
  BASS_W,
  bassEncAt,
  bassKeyAt,
  bassKnobAt,
  bassLockAt,
  bassPlateClear,
  bassTrigAt,
  bassX,
  isBassScreenKey,
  type BassKeyKind,
  type BassPageKey,
} from './theme';

/** L'echo d'un reglage tourne (2026-10-08) : le temps qu'il reste (le bloc cerne, ou l'echo plein ecran hors page). */
const ECHO_MS = 1200;
/** LOCK : la periode du clignotement du pas regle (ms) et la part allumee. */
const BLINK = { period: 760, on: 0.62 } as const;
/** La page d'une touche de page. */
const PAGE_OF: Readonly<Record<BassPageKey, BassPageId>> = { pvoice: 'voice', pfilter: 'filter', penv: 'env', pfx: 'fx' };
const isPageKey = (k: BassKeyKind): k is BassPageKey => (BASS_PAGE_KEYS as readonly string[]).includes(k);

const AXIS_Y = new Vector3(0, 1, 0);
const m4 = new Matrix4();
const v3 = new Vector3();
const q = new Quaternion();
const q0 = new Quaternion();
const s3 = new Vector3();

export interface BassRigOpts {
  mobile: boolean;
  anisotropy: number;
  /** mouvement reduit : OPEN pose son etat final sans animation */
  reduced: () => boolean;
  repaint: () => void;
  invalidate: () => void;
  /** des zones ont change (l'ecran des presets, le capot) : le picking se refait */
  hitChanged: () => void;
}

/* ---------------- les ids des commandes ---------------- */

export const bassKnobId = (k: BassKnobId): string => `bass-knob-${k}`;
/** Un encodeur (2026-10-08) : k de 0 a 7, bass-enc-1 a bass-enc-8 (MIDI : bass:knob:1 a 8). */
export const bassEncId = (k: number): string => `bass-enc-${k + 1}`;
export const bassKeyId = (k: BassKeyKind): string => `bass-key-${k}`;
/** La touche "i" de l'ecran (2026-10-08). */
export const BASS_I_ID = 'bass-key-i';
/** La pastille P-LOCK 05 de l'en-tete de l'ecran (2026-10-09) : la toucher sort du P-LOCK. */
export const BASS_PLOCK_ID = 'bass-lcd-plock';
/** Le rouleau d'EDIT (2026-10-09) : on y glisse la hauteur des notes. */
export const BASS_ROLL_ID = 'bass-roll';
/** Le rouleau d'EDIT sur l'ecran (2026-10-09) ; false depuis le 2026-10-10 : le panneau EDIT (bass/EditPanel.tsx) le remplace. */
const EDIT_ON_SCREEN = false;
/** Le rouleau d'EDIT est-il sur l'ecran (ses zones a la place des blocs) ? */
const rollOnScreen = (): boolean => EDIT_ON_SCREEN && editor.get() === 'bass';
/** Un bloc de l'ecran (2026-10-08, la revue) : k de 0 a 7, bass-blk-1 a 8, il repond comme son encodeur. */
export const bassBlockId = (k: number): string => `bass-blk-${k + 1}`;
export const bassTrigId = (i: number): string => `bass-trig-${i + 1}`;
export const bassLockId = (i: number): string => `bass-lock-${i + 1}`;
export const bassLcdId = (k: PresetKey): string => `bass-lcd-${k}`;
/**
 * Un onglet de l'en-tete de l'ecran, au telephone seulement (2026-10-09, la revue : le toucher ouvrait les presets) :
 * bass-tab-voice a bass-tab-fx, il tourne sa page comme la touche de page dessous (MIDI LEARN : la meme cible).
 */
export const bassTabId = (p: BassPageId): string => `bass-tab-${p}`;
/** Une puce d'onglet de l'en-tete (2026-10-09) : bass-scr-voice, osc, mix, filter, contour, env, fx (MIDI LEARN : bass:screen:<ecran>). */
export const bassScrId = (s: BassScreenId): string => `bass-scr-${s}`;

/* ---------------- le corps ---------------- */

/** Les coordonnees de la brosse (roughnessMap) : x et z, comme le dessus du MM-DECKS. */
function brushUv(g: BufferGeometry): void {
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getZ(i);
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

/**
 * Le dessus (2026-10-07, Mika : "MM-BASS devrait avoir la meme forme de
 * boitier que MM-RYTM, un peu arrondi sur les bordures mais pas trop") : la
 * dalle du MM-RYTM, coins arrondis (0.2, plus le biseau de 0.1), 0.14
 * d'epaisseur, posee sur le coin ; plus de vis (le MM-RYTM n'en a pas).
 * Depuis le 2026-10-08 c'est le capot (buildLid) : OPEN le souleve.
 */
const SLAB = { t: BASS_LID.t, r: 0.2, bevel: 0.1 } as const;

/** Le bac : le coin descendu de l'epaisseur du capot (son fond sombre), les pieds, la connectique derriere. */
function buildBody(mobile: boolean): BufferGeometry {
  const seg = mobile ? 12 : 16;
  const hw = BASS_W / 2;
  const hd = BASS_D / 2;
  const parts: BufferGeometry[] = [wedge(-hw, hw, BASS_D, SLAB.t, 'body')];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new CylinderGeometry(0.3, 0.3, DJ_BODY.feet, seg);
      f.translate(sx * (hw - 0.6), DJ_BODY.feet / 2, sz * (hd - 0.6));
      parts.push(partDj(f, 'rubber'));
    }
  }
  // Derriere : sorties, USB-C, alimentation (vu de derriere, la gauche est a +x), ramenees sur notre face arriere
  const y = 0.78;
  const C = PORTRAIT ? { rca: [3.0, 2.65], usb: 1.7, dc: -2.7, power: -3.3 } : { rca: [4.4, 4.05], usb: 3.0, dc: -4.2, power: -4.8 };
  const back = [...rca(C.rca[0], y, seg), ...rca(C.rca[1], y, seg), ...usb(C.usb, y), ...dc(C.dc, y, seg), ...power(C.power, y)];
  for (const b of back) b.translate(0, 0, (DJ_UNIT.d - BASS_D) / 2);
  parts.push(...back);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('bass: body merge failed');
  brushUv(g);
  return g;
}

/** Le capot (repere top) : la dalle arrondie et le cadre de l'ecran, poses par dj/body.ts dans le repere du bloc et ramenes dans celui du capot. */
function buildLid(): BufferGeometry {
  const slope = BASS_D / Math.cos(DJ_TILT);
  const parts = [roundSlab(BASS_W, slope, SLAB.t, SLAB.r, SLAB.bevel), bezel(BASS.screen.x, BASS.screen.z, BASS.screen.w, BASS.screen.d)];
  const inv = TOP_M.clone().invert();
  for (const p of parts) p.applyMatrix4(inv);
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('bass: lid merge failed');
  brushUv(g);
  return g;
}

/**
 * Un encodeur sans fin (2026-10-08) ; redessine le meme jour apres la revue
 * (le capuchon gris plat et son point faisaient un bouchon, pas une machine) :
 * sur la bague d'aluminium des potards du MM-DECKS, un capuchon noir au
 * moletage fin (quatre facettes par cannelure, pas d'escalier), son dessus
 * satine un peu en retrait (une collerette), un court trait os pres du bord,
 * comme les encodeurs des Elektron : il montre que l'encodeur tourne, la
 * valeur est a l'ecran.
 */
function encoderGeometry(mobile: boolean): BufferGeometry {
  const K = DJ_KNOB;
  const seg = mobile ? 64 : 96;
  const flutes = seg / 4;
  const depth = 0.009;
  const skirt = new CylinderGeometry(K.skirt.rTop, K.skirt.r, K.skirt.h, mobile ? 28 : 40);
  skirt.translate(0, K.skirt.h / 2, 0);
  const cap = new CylinderGeometry(K.rTop, K.r, K.h, seg, 1);
  const p = cap.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const k = 1 - (depth / r) * Math.max(0, Math.cos(Math.atan2(z, x) * flutes)) ** 2;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  cap.computeVertexNormals();
  cap.translate(0, K.skirt.h + K.h / 2, 0);
  const top = K.skirt.h + K.h;
  const face = new CylinderGeometry(K.rTop - 0.032, K.rTop - 0.026, 0.008, mobile ? 40 : 64);
  face.translate(0, top + 0.004, 0);
  const tick = new BoxGeometry(0.024, 0.006, 0.07);
  tick.translate(0, top + 0.009, -(K.rTop - 0.032 - 0.016 - 0.035));
  const parts = [partDj(skirt, 'skirt'), partDj(cap, 'knob'), partDj(face, 'cap'), partDj(tick, 'mark')];
  const g = mergeGeometries(parts, false);
  for (const x of parts) x.dispose();
  if (!g) throw new Error('bass: encoder merge failed');
  return g;
}

/* ---------------- la serigraphie ---------------- */

const knobLabelZ = (z: number, s: number): number => z - DJ_KNOB.skirt.r * s - 0.22 * Math.max(0.9, Math.min(s, 1.3));
/** Au telephone, les inscriptions un tiers plus grandes (le bloc se voit plus petit). */
const INK_K = PORTRAIT ? 1.3 : 1;

function silkItems(): { texts: Text[]; lines: Line[]; brackets: Bracket[] } {
  const texts: Text[] = headTexts('MM-BASS', 'MONO BASS SYNTH', BASS_W, BASS.head.z, 1.95);
  // Le firmware, a gauche du logotype (2026-10-07, Mika : "V1 sur BASS", comme V3 sur le MM-RYTM ; V2 la refonte du
  // 2026-10-08, V3 la machine Elektron du meme jour)
  texts.push({ text: 'FIRMWARE V.3.0 / 2026', x: BASS_W / 2 - (PORTRAIT ? 1.0 : 1.05), z: BASS.head.z + 0.035, cap: PORTRAIT ? 0.058 : 0.065, align: 'right', alpha: 0.45 });
  const lines: Line[] = [];
  const brackets: Bracket[] = [];
  const tick = (x: number, z: number, deg: number, r0: number, r1: number): void => {
    const a = (deg * Math.PI) / 180;
    lines.push([x + Math.cos(a) * r0, z - Math.sin(a) * r0, x + Math.cos(a) * r1, z - Math.sin(a) * r1]);
  };
  // STYLE et NOTES : le nom au-dessus, en orange (le generateur) ; STYLE ses onze crans, NOTES (2026-10-09, l'ancien
  // DENSITY, la meme taille) ses dix-sept, et au desktop un petit 0 et 16 au bout de l'arc
  for (const p of BASS_KNOB_PLACES) {
    const def = BASS_KNOBS.find((k) => k.id === p.id);
    const r = DJ_KNOB.skirt.r * p.s;
    texts.push({ text: def?.label ?? p.id, x: p.x, z: knobLabelZ(p.z, p.s), cap: (p.id === 'style' ? 0.07 : 0.058) * INK_K, weight: 700, maxW: PORTRAIT ? 1.7 : 1.1, group: 'gen', ink: 'orange', alpha: 1 });
    if (def?.steps) for (let t = 0; t < def.steps; t += 1) tick(p.x, p.z, 225 - (t * 270) / (def.steps - 1), r + 0.03, r + (p.id === 'density' && t % 4 !== 0 ? 0.065 : 0.09));
    else for (const deg of [225, -45]) tick(p.x, p.z, deg, r + 0.03, r + 0.08);
    if (p.id === 'density' && !PORTRAIT) {
      const R = r + 0.17;
      const c = Math.SQRT1_2;
      texts.push({ text: '0', x: p.x - c * R, z: p.z + c * R + 0.03, cap: 0.045 * INK_K, weight: 700, alpha: 0.8, group: 'gen' });
      texts.push({ text: '16', x: p.x + c * R, z: p.z + c * R + 0.03, cap: 0.045 * INK_K, weight: 700, alpha: 0.8, group: 'gen' });
    }
  }
  // Les encodeurs (2026-10-08) ; depuis le soir du 2026-10-09 de vrais potards 0 a 127 (le filtre et son enveloppe). L'etape 2 (2026-10-09, Mika : "ils ne servent
  // qu'a faire les modifs des FX globaux de la machine") : chacun tient pour de bon un FX global, son nom au-dessus
  // (DRIVE, DELAY...), le crochet GLOBAL FX au-dessus de la rangee du haut ; la boite ne change pas, seulement ses mots.
  // Au telephone, aucun (2026-10-09) : les lettres sont dans les blocs de l'ecran
  const er = DJ_KNOB.skirt.r * BASS_ENC_S;
  for (let k = 0; k < BASS_ENC_N; k += 1) {
    const p = bassEncAt(k);
    const id = BASS_FX_KNOBS[k];
    const label = id ? bassKnob(id).label : ENC_LETTERS[k];
    texts.push({ text: label, x: p.x, z: p.z - er - 0.14, cap: 0.06 * INK_K, weight: 700, alpha: 0.85, maxW: 0.92, group: 'enc' });
    // Un vrai potard (2026-10-09, le soir) : son arc de 270 degres, onze crans, les bouts et le milieu plus longs
    for (let t = 0; t <= 10; t += 1) tick(p.x, p.z, 225 - t * 27, er + 0.03, er + (t % 5 === 0 ? 0.085 : 0.06));
  }
  if (BASS_ENC_N > 0) {
    const a = bassEncAt(0);
    const d = bassEncAt(3);
    brackets.push({ text: 'FILTER', x0: a.x - er - 0.04, x1: d.x + er + 0.04, z: a.z - er - 0.4, down: true });
    // La face simple (2026-10-09, le soir) : les rangees s'etagent sur la hauteur de l'ecran ; la seconde (F.ATTACK,
    // DECAY, F.SUSTAIN, RELEASE) porte son nom, le contour du filtre (CONTOUR sur le Minimoog)
    const e = bassEncAt(4);
    const h = bassEncAt(7);
    brackets.push({ text: 'CONTOUR', x0: e.x - er - 0.04, x1: h.x + er + 0.04, z: e.z - er - 0.4, down: true });
  }
  // Les touches : leur nom au-dessus (RUN, EDIT, OPEN, GEN en orange) ; un filet entre les groupes de la rangee de jeu (desktop)
  for (const k of BASS_KEYS) {
    const big = k.kind === 'edit' || k.kind === 'open';
    const page = isPageKey(k.kind);
    // Au telephone les noms des pages plus grands (2026-10-09) : sous l'ecran, ce sont eux qui menent (la revue : 4 px de
    // haut, 0.07 -> 0.1, ils tiennent encore entre le cadre de l'ecran et leur touche)
    const pageCap = PORTRAIT ? 0.1 : 0.062;
    texts.push({ text: k.label, x: k.x, z: k.z - k.d / 2 - (page ? 0.12 : 0.15), cap: (big ? 0.072 : page ? pageCap : 0.058) * INK_K, weight: 700, group: page ? 'pages' : 'keys', maxW: k.w + 0.2, ...(k.orange ? { ink: 'orange' as const, alpha: 1 } : {}) });
  }
  // PARAMETER sous les touches de page (le crochet des Elektron)
  const pk = BASS_KEYS.filter((k) => isPageKey(k.kind));
  const pz = Math.max(...pk.map((k) => k.z + k.d / 2)) + 0.2;
  brackets.push({ text: 'PARAMETER', x0: Math.min(...pk.map((k) => k.x - k.w / 2)) - 0.04, x1: Math.max(...pk.map((k) => k.x + k.w / 2)) + 0.04, z: pz });
  // GENERATOR sous STYLE et NOTES (la face simple, 2026-10-09, le soir : GEN est dans le carre GEN PRESET / RUN CLEAR),
  // de la largeur des colonnes de touches qui sont dessous (desktop GEN PRESET, telephone RUN CLEAR) ; juste sous les
  // crans des potards
  const K = (s: number): number => DJ_KNOB.skirt.r * s;
  for (const g of BASS_SECTIONS) {
    const ps = g.ids.map(bassKnobAt);
    const under = BASS_KEYS.filter((k) => (PORTRAIT ? k.kind === 'run' || k.kind === 'clear' : k.kind === 'gen' || k.kind === 'preset'));
    const x0 = Math.min(...ps.map((p) => p.x - K(p.s)), ...under.map((k) => k.x - k.w / 2)) - 0.04;
    const x1 = Math.max(...ps.map((p) => p.x + K(p.s)), ...under.map((k) => k.x + k.w / 2)) + 0.04;
    const z = Math.max(...ps.map((p) => p.z + K(p.s))) + (PORTRAIT ? 0.2 : 0.24);
    brackets.push({ text: g.name, x0, x1, z, ...(g.ink ? { ink: g.ink } : {}) });
  }
  // Les pas : leur numero dessous (1, 5, 9, 13 plus marques), LOCK au-dessus des boutons, le crochet qui dit les gestes
  const T = BASS.trigs;
  for (let i = 0; i < BASS_STEPS; i += 1) {
    const p = bassTrigAt(i);
    texts.push({ text: String(i + 1), x: p.x, z: p.z + T.d / 2 + 0.13, cap: 0.058 * INK_K, weight: 700, alpha: i % 4 === 0 ? 1 : 0.5, group: 'trigs' });
  }
  const t0 = bassTrigAt(PORTRAIT ? 8 : 0).x - T.w / 2;
  const t1 = bassTrigAt(15).x + T.w / 2;
  // Au telephone, plus gros que le filet (2026-10-08, la revue : 3.5 px de haut, illisible) : un texte et ses traits
  const legend = (text: string, x0: number, x1: number, z: number, cap: number, down: boolean): void => {
    const mid = (x0 + x1) / 2;
    const half = (cap / 0.7) * 0.36 * text.length + 0.12;
    const t = down ? z + 0.08 : z - 0.08;
    texts.push({ text, x: mid, z, cap, weight: 700, alpha: 0.9, group: 'legend' });
    lines.push([x0, t, x0, z, mid - half, z], [mid + half, z, x1, z, x1, t]);
  };
  // L'etape 2 (2026-10-09, Mika : "quand on selectionne un step on rentre en parameters lock") : une tape choisit le
  // pas en P-LOCK, l'ecran regle alors ce pas seul ; au telephone, le meme geste au doigt
  const how = 'TAP A STEP: NOTE ON, OFF  /  HOLD A STEP AND DRAG A VALUE ON THE SCREEN: P-LOCK, THAT STEP ONLY';
  if (PORTRAIT) legend('TAP: NOTE ON, OFF  /  HOLD + DRAG A VALUE: P-LOCK', t0, t1, bassTrigAt(15).z + T.d / 2 + 0.36, 0.105, false);
  else brackets.push({ text: how, x0: t0, x1: t1, z: bassTrigAt(15).z + T.d / 2 + 0.42 });
  // Le filet LOCK au-dessus des boutons LOCK (2026-10-08, la revue : la rangee n'avait pas de nom, et le "(OR LOCK)"
  // du filet du bas ne montrait rien) ; au telephone, un par rangee
  const Lk = BASS.locks;
  for (const [a, b] of !BASS_LOCK_KEYS ? [] : PORTRAIT ? [[0, 7], [8, 15]] : [[0, 15]]) {
    const la = bassLockAt(a);
    const lb = bassLockAt(b);
    const z = la.z - BASS_LOCK_LEGEND_DZ;
    if (PORTRAIT) legend(a === 0 ? 'LOCK  STEPS 1-8' : 'LOCK  STEPS 9-16', la.x - Lk.w / 2, lb.x + Lk.w / 2, z, 0.095, true);
    else brackets.push({ text: 'LOCK: P-LOCK THIS STEP  /  AGAIN: OUT', x0: la.x - Lk.w / 2, x1: lb.x + Lk.w / 2, z, down: true });
  }
  return { texts, lines, brackets };
}

/* ---------------- le rig ---------------- */

export class BassRig {
  readonly root = new Group();
  readonly socle = new Group();
  /** le capot : la dalle et tout ce qui est dessus ; OPEN le souleve */
  readonly top = new Group();
  /** le fond du bac (le repere top ferme, il ne bouge pas) : la carte y sort */
  readonly inner = new Group();
  readonly pcbGroup = new Group();
  readonly pcb: Pcb;
  /** la plaque TWEAKS sous le capot : les reglages fins, INFOS et CLOSE s'y posent (son repere top) */
  readonly tweaks: BassTweaks;
  readonly explode: Explode;
  readonly screen: BassScreen;
  private body: Mesh;
  private lid: Mesh;
  private bodyMat: MeshStandardMaterial;
  private brush: Texture;
  /** STYLE et DENSITY */
  private knobs: InstancedMesh;
  /** les huit encodeurs (2026-10-08) ; null au telephone (2026-10-09, plus d'encodeurs) */
  private encs: InstancedMesh | null;
  private keys: InstancedMesh;
  private trigs: InstancedMesh;
  private locks: InstancedMesh;
  private silk: DjSilk;
  private materials: MeshStandardMaterial[] = [];
  private keyEm: InstancedBufferAttribute;
  private trigEm: InstancedBufferAttribute;
  private lockEm: InstancedBufferAttribute;
  private knobAngle = new Float32Array(BASS_KNOBS.length);
  /** l'angle de chaque encodeur (il tourne avec le geste, sans fin) et la valeur qu'il montrait */
  private encAngle = new Float32Array(8);
  private encShown = new Float32Array(8).fill(NaN);
  private encFor = '';
  private keyY = new Float32Array(BASS_KEYS.length);
  private trigY = new Float32Array(BASS_STEPS);
  private lockY = new Float32Array(BASS_STEPS);
  private lcdDefs: HotspotDef[] = [];
  /** la touche "i" et les huit blocs de la PAGE : eteints quand l'ecran montre autre chose (PRESETS, EDIT) */
  private iDef: HotspotDef | null = null;
  private blockDefs: HotspotDef[] = [];
  private tweakDefs: HotspotDef[] = [];
  /**
   * au telephone (2026-10-09) : les onglets de l'en-tete, le pattern (bass-lcd-open) et le verre inerte a gauche et a
   * droite, poses ou l'ecran les dessine (syncHead)
   */
  private tabDefs: HotspotDef[] = [];
  /** les puces des onglets (2026-10-09) */
  private chipDefs: HotspotDef[] = [];
  /** la puce sous la souris (desktop), null : aucune */
  private hoverChip: BassScreenId | null = null;
  private openDef: HotspotDef | null = null;
  private stillDefs: HotspotDef[] = [];
  /** la pastille P-LOCK 05, la ligne du titre et le rouleau d'EDIT (2026-10-09) : poses ou l'ecran les dessine */
  private plockDef: HotspotDef | null = null;
  private titleDef: HotspotDef | null = null;
  private rollDef: HotspotDef | null = null;
  /** le bloc de l'ecran sous la souris (desktop, 2026-10-09), -1 : aucun ; la colonne du rouleau d'EDIT sous la souris */
  private hoverBlock = -1;
  private hoverRoll = -1;
  /** la note qu'on glisse au rouleau d'EDIT (2026-10-09) : son pas et son nom ; null : aucune */
  private rollDrag: { step: number; name: string; lo?: number; hi?: number } | null = null;
  /** un dessin de l'ecran demande (les notifications d'un meme geste n'en font qu'un) */
  private drawQueued = false;
  /** l'ecran a ete dessine une fois (le message de la migration attend ce moment, 2026-10-09) */
  private screenUp = false;
  private defs: HotspotDef[];
  private unsubs: (() => void)[] = [];
  private held = new Set<string>();
  private stepAt = -1;
  private glow = APPEARANCE.current === 'light' ? 1.6 : 1;
  private explodeGoal = false;
  private detach: () => void = () => undefined;
  /** LOCK : le pas regle clignote (allume ou non a cette image) */
  private blink = true;
  /** l'echo du reglage tourne : son minuteur de fin */
  private echoTimer = 0;
  /** ce que l'ecran montre (les tests le lisent, debug.ts) ; band : sa bande des touches du pas (2026-10-09, le soir) */
  private shown: BassScreenView | null = null;
  private band: BassKeysModel | null = null;
  /** les blocs de l'ecran tenus (2026-10-09) : rang 0 a 7, le nombre de pointeurs qui le tiennent ; cernes a l'ecran */
  private heldBlocks = new Map<number, number>();
  /** les encodeurs de la face tenus (desktop, les FX globaux) : leur bulle reste tant qu'on les tient */
  private heldFx = new Map<number, number>();
  /** les potards dedies tenus (STYLE, DENSITY..., la plaque) : leur echo reste ; le dernier lache et quand */
  private heldPots = new Map<BassKnobId, number>();
  private potUp: { id: BassKnobId; at: number } | null = null;

  constructor(private opts: BassRigOpts) {
    this.root.name = 'bassRoot';
    this.root.position.x = bassX();
    this.socle.name = 'bassSocle';
    this.top.name = 'bassTop';
    this.top.position.set(0, DJ_TOP_Y, 0);
    this.top.rotation.x = DJ_TILT;
    this.inner.name = 'bassInner';
    this.inner.position.set(0, DJ_TOP_Y, 0);
    this.inner.rotation.x = DJ_TILT;
    this.pcbGroup.name = 'bassPcbGroup';
    this.pcbGroup.position.y = BASS_PCB_Y;
    this.pcbGroup.rotation.y = PCB_TURN;
    this.pcbGroup.visible = false;
    this.inner.add(this.pcbGroup);
    this.root.add(this.socle, this.inner, this.top);

    const light = APPEARANCE.current === 'light';
    this.brush = makeBrushTexture();
    this.bodyMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughnessMap: this.brush, roughness: light ? 0.55 : 0.68, metalness: light ? 0 : 0.22 });
    this.bodyMat.name = 'bassBody';
    this.body = new Mesh(buildBody(opts.mobile), this.bodyMat);
    this.body.name = 'bassBody';
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.socle.add(this.body);
    this.lid = new Mesh(buildLid(), this.bodyMat);
    this.lid.name = 'bassLid';
    this.lid.castShadow = true;
    this.lid.receiveShadow = true;
    this.top.add(this.lid);

    // L'interieur : la carte (celle du MM-RYTM, degagee sous la plaque) et la plaque TWEAKS
    this.pcb = new Pcb(opts.mobile, opts.anisotropy, { model: 'MM-BASS R2.0', variant: 'voy', chips: false, clear: bassPlateClear() });
    this.pcbGroup.add(this.pcb.board, this.pcb.parts);
    this.tweaks = new BassTweaks({ mobile: opts.mobile, anisotropy: opts.anisotropy });
    this.pcb.parts.add(this.tweaks.group);
    const cfg: ExplodeCfg = { ...BASS_EXPLODE, plateauY: DJ_TOP_Y, pcbY: BASS_PCB_Y, tilt: DJ_TILT };
    this.explode = new Explode({ plateau: this.top, pcb: this.pcbGroup, parts: this.pcb.parts }, (open) => bassExplode.settle(open), cfg);

    const std = (name: string, p: { roughness: number; metalness: number }, led = false): MeshStandardMaterial => {
      const m = new MeshStandardMaterial({ vertexColors: true, ...p });
      m.name = name;
      this.materials.push(m);
      return led ? withRubberLed(m) : m;
    };
    const knobMat = std('bassKnob', { roughness: 0.42, metalness: 0.28 });
    // STYLE et DENSITY : capuchon noir, repere os (des potards : leur angle est leur valeur)
    this.knobs = new InstancedMesh(knobGeometry(opts.mobile, 'knob', 'mark'), knobMat, Math.max(1, BASS_KNOBS.length));
    this.knobs.name = 'bassKnobs';
    // Plus de potard sur la face (2026-10-10) : la maille reste, vide
    this.knobs.count = BASS_KNOBS.length;
    // Les encodeurs : aluminium cannele, un point sombre (il montre le geste, pas une valeur) ; aucun au telephone
    this.encs = BASS_ENC_N > 0 ? new InstancedMesh(encoderGeometry(opts.mobile), knobMat, BASS_ENC_N) : null;
    if (this.encs) this.encs.name = 'bassEncoders';
    const kg = keyGeometry(opts.mobile);
    this.keyEm = new InstancedBufferAttribute(new Float32Array(BASS_KEYS.length * 3), 3);
    this.keyEm.setUsage(DynamicDrawUsage);
    kg.setAttribute('instanceEmissive', this.keyEm);
    this.keys = new InstancedMesh(kg, std('bassKey', { roughness: 0.9, metalness: 0 }, true), BASS_KEYS.length);
    this.keys.name = 'bassKeys';
    const tg = keyGeometry(opts.mobile);
    this.trigEm = new InstancedBufferAttribute(new Float32Array(BASS_STEPS * 3), 3);
    this.trigEm.setUsage(DynamicDrawUsage);
    tg.setAttribute('instanceEmissive', this.trigEm);
    this.trigs = new InstancedMesh(tg, std('bassTrig', { roughness: 0.85, metalness: 0 }, true), BASS_STEPS);
    this.trigs.name = 'bassTrigs';
    const lg = keyGeometry(opts.mobile);
    this.lockEm = new InstancedBufferAttribute(new Float32Array(BASS_STEPS * 3), 3);
    this.lockEm.setUsage(DynamicDrawUsage);
    lg.setAttribute('instanceEmissive', this.lockEm);
    this.locks = new InstancedMesh(lg, std('bassLock', { roughness: 0.88, metalness: 0 }, true), BASS_STEPS);
    this.locks.name = 'bassLocks';
    // Les boutons LOCK retires de la face (2026-10-09, le soir) : la maille reste, cachee (son code de LED ne change pas)
    this.locks.visible = BASS_LOCK_KEYS;
    for (const m of this.meshes()) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.castShadow = !opts.mobile;
      m.receiveShadow = true;
    }
    this.top.add(...this.meshes());

    this.screen = new BassScreen(opts.anisotropy, opts.mobile);
    this.top.add(this.screen.mesh);
    this.silk = new DjSilk({ name: 'bassSilk', w: BASS_W, x: 0, items: silkItems, logo: BASS.logo, d: Math.max(BASS_D, DJ_UNIT.d) }, opts.anisotropy, opts.mobile);
    this.top.add(this.silk.mesh);

    BASS_KNOBS.forEach((k, i) => {
      this.knobAngle[i] = potAngle(bassKnobValue(k.id));
      this.placeKnob(i);
    });
    for (let k = 0; k < BASS_ENC_N; k += 1) {
      // Des angles de depart un peu differents : huit encodeurs poses a la main, pas un alignement de jouet
      // Un vrai potard de 0 a 127 (2026-10-09, Mika : "j'aimerais qu'ils aillent de 0 a 127 normaux, la ils font deux tours")
      const id = BASS_FX_KNOBS[k];
      this.encAngle[k] = potAngle(id ? bassParams.of(id) : 0);
      this.placeEnc(k);
    }
    this.syncEncs();
    BASS_KEYS.forEach((_, i) => this.placeKey(i));
    for (let i = 0; i < BASS_STEPS; i += 1) {
      this.placeTrig(i);
      this.placeLock(i);
    }
    this.tweaks.sync(bassKnobValue);
    this.defs = this.buildHotspots();
    this.syncLights();
    this.drawScreen();
  }

  /** Les maillages instancies de la face (sans encodeurs au telephone). */
  private meshes(): InstancedMesh[] {
    return [this.knobs, ...(this.encs ? [this.encs] : []), this.keys, this.trigs, this.locks];
  }

  /* ---------- placement ---------- */

  private placeKnob(i: number): void {
    const p = bassKnobAt(BASS_KNOBS[i].id);
    this.knobs.setMatrixAt(i, m4.compose(v3.set(p.x, 0, p.z), q.setFromAxisAngle(AXIS_Y, this.knobAngle[i]), s3.set(p.s, p.s, p.s)));
    this.knobs.instanceMatrix.needsUpdate = true;
  }

  private placeEnc(k: number): void {
    const e = this.encs;
    if (!e) return;
    const p = bassEncAt(k);
    // Un peu plus bas qu'un potard : un encodeur de machine a pas, pas un bouton de volume
    e.setMatrixAt(k, m4.compose(v3.set(p.x, 0, p.z), q.setFromAxisAngle(AXIS_Y, this.encAngle[k]), s3.set(p.s, p.s * 0.82, p.s)));
    e.instanceMatrix.needsUpdate = true;
  }

  private placeKey(i: number): void {
    const p = bassKeyAt(i);
    this.keys.setMatrixAt(i, m4.compose(v3.set(p.x, this.keyY[i], p.z), q0, s3.set(p.w, 1, p.d)));
    this.keys.instanceMatrix.needsUpdate = true;
  }

  private placeTrig(i: number): void {
    const p = bassTrigAt(i);
    const T = BASS.trigs;
    this.trigs.setMatrixAt(i, m4.compose(v3.set(p.x, this.trigY[i], p.z), q0, s3.set(T.w, T.h, T.d)));
    this.trigs.instanceMatrix.needsUpdate = true;
  }

  private placeLock(i: number): void {
    const p = bassLockAt(i);
    const Lk = BASS.locks;
    this.locks.setMatrixAt(i, m4.compose(v3.set(p.x, this.lockY[i], p.z), q0, s3.set(Lk.w, Lk.h, Lk.d)));
    this.locks.instanceMatrix.needsUpdate = true;
  }

  /* ---------- picking ---------- */

  private buildHotspots(): HotspotDef[] {
    const top = this.top;
    const out: HotspotDef[] = [];
    for (const k of BASS_KNOBS) {
      const p = bassKnobAt(k.id);
      const r = DJ_KNOB.skirt.r * p.s + 0.07;
      out.push({ id: bassKnobId(k.id), kind: 'bassknob', layer: top, shape: 'disc', x: p.x, z: p.z, hx: r, hz: r, y0: 0, y1: (DJ_KNOB.skirt.h + DJ_KNOB.h) * p.s, enabled: true, bass: k.id });
    }
    // Les encodeurs : les FX globaux (2026-10-09), bass.bass = global:<id> (MIDI LEARN : bass:global:drive... ; les blocs
    // de l'ecran gardent bass:knob:1 a 8, la page a l'ecran) ; aucun au telephone
    for (let k = 0; k < BASS_ENC_N; k += 1) {
      const p = bassEncAt(k);
      const r = DJ_KNOB.skirt.r * p.s + (PORTRAIT ? 0.16 : 0.08);
      out.push({ id: bassEncId(k), kind: 'bassknob', layer: top, shape: 'disc', x: p.x, z: p.z, hx: r, hz: r, y0: 0, y1: (DJ_KNOB.skirt.h + DJ_KNOB.h) * p.s * 0.82, enabled: true, bass: `global:${BASS_FX_KNOBS[k]}` });
    }
    for (const k of BASS_KEYS) {
      // Une touche de page au telephone (2026-10-09) : sa zone prend son nom et le jour sous l'ecran (BASS_PAGE_HIT)
      const ph = BASS_PAGE_HIT && isPageKey(k.kind) ? BASS_PAGE_HIT : null;
      const z = ph ? (ph.z0 + ph.z1) / 2 : k.z;
      const hz = ph ? (ph.z1 - ph.z0) / 2 : k.d / 2 + (PORTRAIT ? 0.06 : 0);
      out.push({ id: bassKeyId(k.kind), kind: 'basskey', layer: top, shape: 'box', x: k.x, z, hx: k.w / 2, hz, y0: 0, y1: DJ_KEY.h, enabled: true, bass: k.kind });
    }
    const T = BASS.trigs;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const p = bassTrigAt(i);
      out.push({ id: bassTrigId(i), kind: 'basstrig', layer: top, shape: 'box', x: p.x, z: p.z, hx: T.w / 2 + 0.04, hz: T.d / 2 + 0.04, y0: 0, y1: DJ_KEY.h * T.h, enabled: true, bass: String(i) });
    }
    const Lk = BASS.locks;
    for (let i = 0; i < (BASS_LOCK_KEYS ? BASS_STEPS : 0); i += 1) {
      const p = bassLockAt(i);
      out.push({ id: bassLockId(i), kind: 'basslock', layer: top, shape: 'box', x: p.x, z: p.z, hx: Lk.w / 2 + 0.04, hz: Lk.d / 2 + 0.06, y0: 0, y1: DJ_KEY.h * Lk.h, enabled: true, bass: String(i) });
    }
    // L'ecran : le toucher ouvre les presets ; en mode presets, le haut a gauche et a droite (precedent,
    // suivant), la bande du bas en quatre touches (SAVE NAME DEL EXIT), comme les ecrans du MM-RYTM et du MM-ARP
    const S = BASS.screen;
    const band = 0.74;
    const area = (u0: number, u1: number, v0: number, v1: number, y1: number): Pick<HotspotDef, 'x' | 'z' | 'hx' | 'hz' | 'y0' | 'y1'> => ({
      x: S.x - S.w / 2 + ((u0 + u1) / 2) * S.w,
      z: S.z - S.d / 2 + ((v0 + v1) / 2) * S.d,
      hx: ((u1 - u0) / 2) * S.w,
      hz: ((v1 - v0) / 2) * S.d,
      y0: DJ_BEZEL.h - 0.005,
      y1,
    });
    const box = (key: PresetKey, u0: number, u1: number, v0: number, v1: number): HotspotDef => ({
      id: bassLcdId(key),
      kind: 'basslcd',
      lcd: key,
      layer: top,
      shape: 'box',
      ...area(u0, u1, v0, v1, DJ_BEZEL.h + 0.03),
      enabled: key === 'open',
    });
    // L'en-tete seul ouvre les presets (2026-10-08, la revue : toucher un bloc pour choisir son reglage ouvrait les
    // presets) ; les blocs repondent comme leur encodeur (glisser : le tourner ; deux tapes : son verrou s'en va ;
    // INFOS : sa carte), bass.bass = '1' a '8' comme les encodeurs (MIDI LEARN : bass:knob:1 a 8)
    const hr = this.screen.headRect();
    // PRESETS sur la part des vues (2026-10-09, le soir : la bande des touches du pas reste dessous)
    const mv = this.screen.mainV();
    const lcd = [box('open', hr.u0, hr.u1, hr.v0, hr.v1), box('prev', 0, 0.5, 0, band * mv), box('next', 0.5, 1, 0, band * mv), ...(['save', 'name', 'del', 'exit'] as const).map((k, i) => box(k, i / 4, (i + 1) / 4, band * mv, mv))];
    // Le reste du verre (la bande des pas, la ligne du bas ; en EDIT, le rouleau a la place des blocs) : des zones qui
    // ne font rien, sinon le geste passerait a la scene (l'orbite) ; elles ne chevauchent aucune zone allumee
    const lo = this.screen.lowRect();
    const glass: HotspotDef = { id: 'bass-lcd-glass', kind: 'basslcd', layer: top, shape: 'box', ...area(lo.u0, lo.u1, lo.v0, lo.v1, DJ_BEZEL.h + 0.03), enabled: true };
    const glassEdit: HotspotDef = { id: 'bass-lcd-glass-edit', kind: 'basslcd', layer: top, shape: 'box', ...area(0, 1, hr.v1, lo.v0, DJ_BEZEL.h + 0.03), enabled: false };
    // Les six touches du pas (2026-10-09, le soir) : des zones de l'ecran, leurs ids d'avant (bass-key-accent...), un peu
    // au-dessus du verre de leur bande (il ne fait rien : la ligne du pas, les jours entre les touches)
    const kb = this.screen.keysBandRect();
    const glassKeys: HotspotDef = { id: 'bass-lcd-glass-keys', kind: 'basslcd', layer: top, shape: 'box', ...area(kb.u0, kb.u1, kb.v0, kb.v1, DJ_BEZEL.h + 0.03), enabled: true };
    const screenKeys = BASS_SCREEN_KEY_KINDS.map((kind, i): HotspotDef => {
      const r = this.screen.keyRect(i);
      return { id: bassKeyId(kind), kind: 'basskey', layer: top, shape: 'box', ...area(r.u0, r.u1, r.v0, r.v1, DJ_BEZEL.h + 0.06), enabled: true, bass: kind };
    });
    const blocks: HotspotDef[] = [];
    for (let k = 0; k < 8; k += 1) {
      const br = this.screen.blockRect(k);
      blocks.push({ id: bassBlockId(k), kind: 'bassknob', layer: top, shape: 'box', ...area(br.u0, br.u1, br.v0, br.v1, DJ_BEZEL.h + 0.03), enabled: true, bass: String(k + 1) });
    }
    // La touche "i" (2026-10-08) : dans le coin de l'ecran, un peu au-dessus du verre (elle passe avant les presets)
    const ir = this.screen.iRect();
    const iKey: HotspotDef = { id: BASS_I_ID, kind: 'basskey', layer: top, shape: 'box', ...area(ir.u0, ir.u1, ir.v0, ir.v1, DJ_BEZEL.h + 0.06), enabled: true, bass: 'i' };
    // L'etape 2 (2026-10-09) : la pastille P-LOCK 05 de l'en-tete (la toucher sort du P-LOCK), un peu au-dessus du verre
    // comme la touche "i" (elle passe avant les presets), posee ou l'ecran la dessine (syncHead) ; la ligne du titre, un
    // verre qui ne fait rien ; le rouleau d'EDIT, ou l'on glisse les notes (syncRoll)
    const plock: HotspotDef = { id: BASS_PLOCK_ID, kind: 'basslcd', layer: top, shape: 'box', ...area(hr.u0, hr.u0, hr.v0, hr.v1, DJ_BEZEL.h + 0.1), enabled: false };
    const tr = this.screen.titleRect();
    const title: HotspotDef = { id: 'bass-lcd-title', kind: 'basslcd', layer: top, shape: 'box', ...area(tr.u0, tr.u1, tr.v0, tr.v1, DJ_BEZEL.h + 0.03), enabled: true };
    const roll: HotspotDef = { id: BASS_ROLL_ID, kind: 'basslcd', layer: top, shape: 'box', ...area(0, 0, 0, 0, DJ_BEZEL.h + 0.12), enabled: false };
    // Au telephone (2026-10-09, la revue : toucher l'onglet FILTER ouvrait les presets) : chaque onglet tourne sa page
    // (bass.bass : la touche de page, MIDI LEARN bass:key:pfilter...), le pattern seul ouvre les presets (bass-lcd-open),
    // a gauche (la lecture, LOCK 05) et a droite (le tempo) un verre qui ne fait rien (le geste ne passe pas a
    // l'orbite) ; tous poses ou l'ecran les dessine (syncHead). Au desktop aussi depuis la seconde revue du meme jour
    // (l'ecran y est l'editeur : un clic sur l'onglet ENV ouvrait les presets), plus le verre entre les onglets et le
    // pattern (bass-lcd-head-m)
    const head: HotspotDef[] = [
      ...BASS_PAGE_KEYS.map((k): HotspotDef => ({ id: bassTabId(PAGE_OF[k]), kind: 'basskey', layer: top, shape: 'box', ...area(hr.u0, hr.u0, hr.v0, hr.v1, DJ_BEZEL.h + 0.03), enabled: false, bass: k })),
      ...['l', 'm', 'r'].map((k): HotspotDef => ({ id: `bass-lcd-head-${k}`, kind: 'basslcd', layer: top, shape: 'box', ...area(hr.u0, hr.u0, hr.v0, hr.v1, DJ_BEZEL.h + 0.03), enabled: false })),
      // Les puces des onglets (2026-10-09) : un peu au-dessus du verre (elles passent avant la ligne du titre), posees ou
      // l'ecran les dessine (syncHead)
      ...BASS_SCREENS.map((s): HotspotDef => ({ id: bassScrId(s), kind: 'basskey', layer: top, shape: 'box', ...area(hr.u0, hr.u0, hr.v0, hr.v1, DJ_BEZEL.h + 0.06), enabled: false, bass: `screen:${s}` })),
    ];
    // La plaque sous le capot : ses potards, vivants capot ouvert (syncHood)
    const all = [...out, ...screenKeys, iKey, plock, ...blocks, ...lcd, ...head, title, roll, glass, glassEdit, glassKeys, ...this.tweaks.hotspots()].map((d) => ({ ...d, machine: 'bass' as const }));
    this.plockDef = all.find((d) => d.id === BASS_PLOCK_ID) ?? null;
    this.rollDef = all.find((d) => d.id === BASS_ROLL_ID) ?? null;
    this.titleDef = all.find((d) => d.id === 'bass-lcd-title') ?? null;
    this.lcdDefs = all.filter((d) => d.kind === 'basslcd' && d !== this.plockDef && d !== this.rollDef && d !== this.titleDef);
    this.tabDefs = all.filter((d) => d.id.startsWith('bass-tab-'));
    this.chipDefs = all.filter((d) => d.id.startsWith('bass-scr-'));
    this.openDef = all.find((d) => d.id === bassLcdId('open')) ?? null;
    this.stillDefs = all.filter((d) => d.id.startsWith('bass-lcd-head-'));
    this.iDef = all.find((d) => d.id === BASS_I_ID) ?? null;
    this.blockDefs = all.filter((d) => d.id.startsWith('bass-blk-'));
    this.tweakDefs = all.filter((d) => d.id.startsWith('bass-tw-'));
    // Les copies enregistrees suivent la mise en page de la plaque (scene/tweakplate.ts track)
    this.tweaks.track(this.tweakDefs);
    this.syncScreenKeys();
    return all;
  }

  /**
   * Les zones du verre suivent ce qu'il montre ; true si ca change. PRESETS : ses touches seules (la touche "i" n'y
   * est pas dessinee, 2026-10-08, la revue : elle restait vivante par-dessus NEXT) ; EDIT : pas de blocs (le rouleau).
   */
  private syncScreenKeys(): boolean {
    const on = presetMode.on('bass');
    // EDIT ouvert (2026-10-10, Mika : "quand je suis sur EDIT je peux plus rien changer dans VOICE") : le panneau EDIT
    // laisse l'ecran a sa page, ses blocs restent vivants
    const blocks = !on && !rollOnScreen();
    let changed = false;
    const want = (d: HotspotDef, w: boolean): void => {
      if (d.enabled === w) return;
      d.enabled = w;
      changed = true;
    };
    // Les touches des presets en mode presets ; hors presets, l'en-tete (open) et le verre (sans touche ; celui des
    // blocs en EDIT seulement, ou les blocs ne sont pas dessines)
    for (const d of this.lcdDefs) {
      // Au telephone, le pattern et le verre de l'en-tete suivent ce qui est dessine (syncHead)
      if (d === this.openDef || this.stillDefs.includes(d)) continue;
      // Le verre de la bande des touches du pas (2026-10-09, le soir) : toujours la, comme elles
      want(d, d.id === 'bass-lcd-glass-keys' ? true : d.id === 'bass-lcd-glass-edit' ? !on && !blocks : d.lcd === 'open' || !d.lcd ? !on : on);
    }
    if (this.iDef) want(this.iDef, !on);
    for (const d of this.blockDefs) want(d, blocks);
    if (this.titleDef) want(this.titleDef, blocks);
    const head = this.syncHead();
    return this.syncRoll() || head || changed;
  }

  /**
   * Le rouleau d'EDIT (2026-10-09) : sa zone ou l'ecran l'a dessine (BassScreen.editRoll ; il grandit ou retrecit avec
   * les pistes des verrous), eteinte hors EDIT ; true si ca change.
   */
  private syncRoll(): boolean {
    const d = this.rollDef;
    if (!d) return false;
    const g = this.screen.editRoll();
    const live = !!g && !presetMode.on('bass') && rollOnScreen();
    let changed = false;
    if (g) {
      const S = BASS.screen;
      const u0 = g.x0 / g.UW;
      const u1 = g.x1 / g.UW;
      const v0 = g.lenY0 / g.UH;
      const v1 = g.slotY1 / g.UH;
      const x = S.x - S.w / 2 + ((u0 + u1) / 2) * S.w;
      const z = S.z - S.d / 2 + ((v0 + v1) / 2) * S.d;
      const hx = ((u1 - u0) / 2) * S.w;
      const hz = ((v1 - v0) / 2) * S.d;
      if (Math.abs(d.x - x) > 1e-4 || Math.abs(d.z - z) > 1e-4 || Math.abs(d.hx - hx) > 1e-4 || Math.abs(d.hz - hz) > 1e-4) {
        d.x = x;
        d.z = z;
        d.hx = hx;
        d.hz = hz;
        changed = true;
      }
    }
    if (d.enabled !== live) {
      d.enabled = live;
      changed = true;
    }
    return changed;
  }

  /**
   * Au telephone (2026-10-09), et au desktop depuis la seconde revue du meme jour : les onglets et le pattern ou l'ecran
   * les a dessines (BassScreen.headZones, ils bougent quand LOCK 05 entre dans l'en-tete) ; eteints quand il ne les
   * montre pas (PRESETS, EDIT, l'echo : la, l'en-tete entier ouvre les presets, comme avant) ; true si ca change.
   */
  private syncHead(): boolean {
    const S = BASS.screen;
    const hz = this.screen.headZones();
    const on = presetMode.on('bass');
    let changed = false;
    // La pastille P-LOCK 05 (2026-10-09, desktop et telephone) : la ou elle est dessinee, seulement en P-LOCK
    const pd = this.plockDef;
    if (pd) {
      const span = hz.pill;
      const live = !on && !!span && !rollOnScreen();
      if (span) {
        const x = S.x - S.w / 2 + ((span.u0 + span.u1) / 2) * S.w;
        const hx = ((span.u1 - span.u0) / 2) * S.w;
        if (Math.abs(pd.x - x) > 1e-4 || Math.abs(pd.hx - hx) > 1e-4) {
          pd.x = x;
          pd.hx = hx;
          changed = true;
        }
      }
      if (pd.enabled !== live) {
        pd.enabled = live;
        changed = true;
      }
    }
    const put = (d: HotspotDef, span: { u0: number; u1: number; v0?: number; v1?: number } | null | undefined): void => {
      const live = !on && !!span;
      if (span) {
        const x = S.x - S.w / 2 + ((span.u0 + span.u1) / 2) * S.w;
        const hx = ((span.u1 - span.u0) / 2) * S.w;
        // Une hauteur donnee (2026-10-09, la pastille de la page au telephone : 44 px comme les puces)
        const tall = typeof span.v0 === 'number' && typeof span.v1 === 'number';
        const z = tall ? S.z - S.d / 2 + (((span.v0 as number) + (span.v1 as number)) / 2) * S.d : d.z;
        const hzz = tall ? (((span.v1 as number) - (span.v0 as number)) / 2) * S.d : d.hz;
        if (Math.abs(d.x - x) > 1e-4 || Math.abs(d.hx - hx) > 1e-4 || Math.abs(d.z - z) > 1e-4 || Math.abs(d.hz - hzz) > 1e-4) {
          d.x = x;
          d.hx = hx;
          d.z = z;
          d.hz = hzz;
          changed = true;
        }
      }
      if (d.enabled !== live) {
        d.enabled = live;
        changed = true;
      }
    };
    for (const d of this.tabDefs) put(d, hz.tabs.find((t) => bassTabId(t.id) === d.id));
    if (this.openDef) put(this.openDef, hz.open);
    this.stillDefs.forEach((d, i) => put(d, hz.still[i]));
    // Les puces des onglets (2026-10-09) : leur rectangle entier (desktop : la ligne du titre ; telephone : l'en-tete)
    for (const d of this.chipDefs) {
      const c = hz.chips.find((t) => bassScrId(t.id) === d.id);
      const live = !on && !!c && !rollOnScreen();
      if (c) {
        const x = S.x - S.w / 2 + ((c.u0 + c.u1) / 2) * S.w;
        const z = S.z - S.d / 2 + ((c.v0 + c.v1) / 2) * S.d;
        const hx = ((c.u1 - c.u0) / 2) * S.w;
        const hzz = ((c.v1 - c.v0) / 2) * S.d;
        if (Math.abs(d.x - x) > 1e-4 || Math.abs(d.z - z) > 1e-4 || Math.abs(d.hx - hx) > 1e-4 || Math.abs(d.hz - hzz) > 1e-4) {
          d.x = x;
          d.z = z;
          d.hx = hx;
          d.hz = hzz;
          changed = true;
        }
      }
      if (d.enabled !== live) {
        d.enabled = live;
        changed = true;
      }
    }
    return changed;
  }

  /** Le capot : les potards de la plaque repondent ouvert, et pendant l'ouverture des que le capot les a decouverts ; true si ca change. */
  private syncHood(): boolean {
    const s = bassExplode.get();
    const live = s === 'open' || (s === 'opening' && this.explode.p.plateau >= 0.6);
    let changed = false;
    for (const d of this.tweakDefs) {
      if (d.enabled === live) continue;
      d.enabled = live;
      changed = true;
    }
    // Le capot leve sort du cadre ouvert (2026-10-08) : ses commandes ne repondent plus tant que la carte repond
    if (this.top.userData.noPick !== live) {
      this.top.userData.noPick = live;
      changed = true;
    }
    return changed;
  }

  get hotspots(): readonly HotspotDef[] {
    return this.defs;
  }

  /** Les volumes pleins : le bac sous son fond (repere du fond), le capot (le sien, il se souleve). */
  occluders(): Occluder[] {
    const depth = DJ_BODY.front + DJ_BODY.feet;
    const t = BASS_LID.t;
    return [
      { layer: this.inner, min: [-BASS_W / 2, -depth, -BASS_D / 2], max: [BASS_W / 2, -t, BASS_D / 2], tag: 'bass' },
      { layer: this.top, min: [-BASS_W / 2, -t, -BASS_D / 2], max: [BASS_W / 2, 0, BASS_D / 2], tag: 'bass' },
    ];
  }

  /* ---------- etats ---------- */

  private syncLights(): boolean {
    const s = bassState.get();
    let changed = false;
    const g = this.glow;
    const set = (attr: InstancedBufferAttribute, i: number, c: readonly number[]): void => {
      const a = attr.array as Float32Array;
      const r = Math.fround(c[0] * g);
      const gr = Math.fround(c[1] * g);
      const b = Math.fround(c[2] * g);
      if (a[i * 3] === r && a[i * 3 + 1] === gr && a[i * 3 + 2] === b) return;
      a[i * 3] = r;
      a[i * 3 + 1] = gr;
      a[i * 3 + 2] = b;
      attr.needsUpdate = true;
      changed = true;
    };
    const scale = (rgb: readonly number[], k: number): number[] => [rgb[0] * k, rgb[1] * k, rgb[2] * k];
    const editing = editor.get() === 'bass';
    const page = bassPage.get();
    const lockLocks = s.lock >= 0 ? s.steps[s.lock]?.locks : undefined;
    // Les verrous du pas sur tous les onglets d'une page (2026-10-09)
    BASS_KEYS.forEach((k, i) => {
      const held = this.held.has(bassKeyId(k.kind));
      if (k.kind === 'run') {
        set(this.keyEm, i, s.running || held ? DJ_GLOW.yellow : scale(DJ_GLOW.yellow, 0.18));
        return;
      }
      // Les pages (2026-10-08) : la LED de la page allumee ; en LOCK, a demi celles qui portent un verrou sur le pas
      if (isPageKey(k.kind)) {
        const p = PAGE_OF[k.kind];
        const has = !!lockLocks && pageIds(p).some((id) => isLockable(id) && (lockLocks as Record<string, number>)[id] !== undefined);
        set(this.keyEm, i, held || p === page ? DJ_GLOW.orange : has ? scale(DJ_GLOW.orange, 0.32) : DJ_GLOW.dim);
        return;
      }
      const hood = bassExplode.get();
      // PRESET (2026-10-09, le soir) : allumee tant que les presets sont ouverts a l'ecran
      const on = held || (k.kind === 'edit' && editing) || (k.kind === 'open' && (hood === 'opening' || hood === 'open')) || (k.kind === 'preset' && presetMode.on('bass'));
      // EDIT, OPEN, GEN et PRESET : toujours un peu allumes (on les voit tout de suite), vifs quand ils sont pris
      const idle = k.kind === 'edit' || k.kind === 'open' || k.kind === 'gen' || k.kind === 'preset' ? scale(DJ_GLOW.orange, 0.16) : DJ_GLOW.dim;
      set(this.keyEm, i, on ? DJ_GLOW.orange : idle);
    });
    // Les LOCK : pale si le pas a des verrous, or celui qu'on regle (il clignote avec son pas) ; eteints en EDIT
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const held = this.held.has(bassLockId(i));
      const has = !!s.steps[i].locks;
      set(this.lockEm, i, held ? DJ_GLOW.yellow : s.lock === i ? scale(DJ_GLOW.yellow, this.blink ? 1 : 0.3) : editing ? scale(DJ_GLOW.dim, 0.5) : has ? scale(DJ_GLOW.orange, 0.45) : DJ_GLOW.dim);
    }
    const at = this.stepAt;
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const st = s.steps[i];
      const held = this.held.has(bassTrigId(i));
      // Les notes, en EDIT aussi (2026-10-10, Mika : "les touches montrent les notes") : bien allumees, l'accent plein
      const base = st.kind === 'note' ? (st.acc ? DJ_GLOW.orange : scale(DJ_GLOW.orange, 0.78)) : st.kind === 'tie' ? scale(DJ_GLOW.orange, 0.35) : DJ_GLOW.dim;
      // LOCK : le pas qu'on regle clignote en or (comme les trigs verrouilles d'une Elektron)
      const locking = s.lock === i;
      const lit = held || (i === at && st.kind !== 'off') ? DJ_GLOW.yellow : locking ? scale(DJ_GLOW.yellow, this.blink ? 1 : 0.3) : i === at ? scale(DJ_GLOW.yellow, 0.25) : i === s.sel ? scale(base[0] > 0.05 ? base : DJ_GLOW.orange, base[0] > 0.05 ? 1.45 : 0.12) : base;
      // Au-dela de la longueur (2026-10-10) : le pas ne joue pas, sa LED s'eteint presque
      set(this.trigEm, i, i >= s.len && !held && !locking ? scale(DJ_GLOW.dim, 0.35) : lit);
    }
    return changed;
  }

  private syncKnobs(): boolean {
    let moved = false;
    BASS_KNOBS.forEach((k, i) => {
      const a = Math.fround(potAngle(bassKnobValue(k.id)));
      if (this.knobAngle[i] === a) return;
      this.knobAngle[i] = a;
      this.placeKnob(i);
      moved = true;
    });
    if (this.syncEncs()) moved = true;
    // La plaque : ses potards suivent aussi (LENGTH en LOCK : le verrou du pas)
    if (this.tweaks.sync(bassKnobValue)) moved = true;
    return moved;
  }

  /**
   * Les encodeurs (2026-10-08) : un encodeur tourne de ce que son reglage a
   * bouge (le geste, une molette, le MIDI) ; il ne saute pas (un encodeur
   * sans fin n'a pas de position). L'etape 2 (2026-10-09) : son reglage est
   * le FX global qu'il tient, la page et le P-LOCK n'y changent rien.
   */
  private syncEncs(): boolean {
    if (!this.encs) return false;
    const fresh = 'fx';
    const same = fresh === this.encFor;
    this.encFor = fresh;
    let moved = false;
    for (let k = 0; k < BASS_ENC_N; k += 1) {
      const id = BASS_FX_KNOBS[k];
      const v = id ? bassParams.of(id) : 0;
      const was = this.encShown[k];
      this.encShown[k] = v;
      if (same && v === was) continue;
      this.encAngle[k] = potAngle(v);
      this.placeEnc(k);
      moved = true;
    }
    return moved;
  }

  /** Ce que l'ecran doit montrer maintenant : PRESETS, EDIT, l'echo d'un reglage hors page, sinon la PAGE. */
  private screenView(): BassScreenView {
    const s = bassState.get();
    const values = bassParams.get();
    const bpm = pattern.get().bpm;
    const infos = bassInfos.isOn();
    const pv = presetMode.view('bass');
    // Un preset garde avant le moteur MONARK (2026-10-09) : l'ecran des presets le dit (SAVED IN 303 MODE)
    if (pv) {
      const note = presets.bassNote();
      return note ? { view: 'presets', p: pv, note } : { view: 'presets', p: pv };
    }
    const page = bassPage.get();
    const screen = bassPage.screen();
    const p = bassPatterns.get();
    // L'echo (1.2 s) : sur la page, son bloc se cerne ; hors de la page, l'ecran entier un instant ; un encodeur de la
    // face (2026-10-09, les FX globaux) : sa bulle par-dessus la page, qui reste
    const t = s.touched;
    // L'ecran GENERATOR (2026-10-09) : 1.6 s apres GEN, MUTATE, CLEAR et leurs tenues (ms), 1.2 s apres STYLE et NOTES
    let left = t ? (t.ms ?? ECHO_MS) - (performance.now() - t.at) : 0;
    // Un potard dedie tenu (2026-10-09, la revue : l'image de DENSITY partait 1.2 s apres le dernier cran, le doigt
    // encore dessus) : son echo reste tant qu'on le tient, puis 1.2 s apres le lacher, comme la bulle d'un encodeur
    if (t && this.heldPots.has(t.id)) left = Math.max(left, ECHO_MS);
    else if (t && this.potUp && this.potUp.id === t.id) left = Math.max(left, ECHO_MS - (performance.now() - this.potUp.at));
    window.clearTimeout(this.echoTimer);
    if (t && left > 0) {
      this.echoTimer = window.setTimeout(() => {
        if (this.drawScreen()) this.opts.repaint();
      }, left + 16);
    }
    const fresh = !!t && left > 0;
    // EDIT sur l'ecran (le rouleau) : remplace le 2026-10-10 par le panneau du MM-RYTM (bass/EditPanel.tsx), l'ecran garde sa page
    if (EDIT_ON_SCREEN && editor.get() === 'bass') {
      const m: BassEditModel = bassEditModel({
        steps: s.steps,
        values,
        page,
        screen,
        running: s.running,
        playing: this.stepAt,
        sel: s.sel,
        bpm,
        cur: p.cur,
        next: p.next,
        chain: p.chain,
        filled: Array.from({ length: BASS_SLOTS }, (_, i) => bassPatterns.filled(i)),
        message: s.message,
        infos,
        midiOf: (st) => midiOf(st),
        // Au telephone trois pistes depuis l'ecran plus grand (2026-10-09)
        maxLanes: 3,
        drag: this.rollDrag,
        hover: this.hoverRoll,
        phone: PORTRAIT,
        len: s.len,
      });
      return { view: 'edit', m };
    }
    let echo: BassKnobId | null = null;
    let pop: { k: number; id: BassKnobId } | null = null;
    if (t && fresh && (t.gen || t.id === 'style' || t.id === 'density')) {
      // L'ecran GENERATOR (2026-10-09, Mika : "j'aime bien l'image qu'il y a dans density") : la prise, le compte, les
      // seize cases (ce qui vient d'arriver, de partir, tes notes, la suivante de NOTES + 1 et - 1), la ligne du bas
      const r = bassLine.get();
      const nx = bassLine.nextSteps();
      const cells = genCellsOf(s.steps, t.before, s.lock).map((c, i) => ({ ...c, plus: i === nx.plus, minus: i === nx.minus, playing: s.running && i === this.stepAt }));
      return {
        view: 'gen',
        g: { style: styleName(r.style), take: bassTakeName().slice(styleName(r.style).length + 1), count: bassLine.count(), yours: bassLine.yours(), cells, note: t.note ?? '', lock: s.lock },
        running: s.running,
        bpm,
        infos,
      };
    }
    if (t && fresh) {
      // Sur l'onglet allume (VOLUME est sur VOICE et sur FX, la revue du 2026-10-09 ; DECAY, ENV MOD, SUB, DRIVE sur deux
      // onglets) : son bloc se cerne ; ailleurs l'echo plein ecran
      const at = BASS_SCREEN_SLOTS[screen].includes(t.id) ? { page } : null;
      // La bulle d'un encodeur de la face : au desktop seulement (la revue : au telephone, sans encodeurs, le MIDI
      // bass:global:<id> nommait un KNOB A qui n'y est pas ; l'echo d'un reglage, comme un autre)
      if (t.enc !== undefined && t.enc >= 0 && !PORTRAIT) pop = { k: t.enc, id: t.id };
      else if (at && at.page === page) echo = t.id;
      else {
        const lockV = s.lock >= 0 && isLockable(t.id) ? s.steps[s.lock]?.locks?.[t.id] : undefined;
        return {
          view: 'knob',
          k: { id: t.id, v: bassKnobValue(t.id), locked: lockV !== undefined, lock: s.lock },
          running: s.running,
          bpm,
          values: s.lock >= 0 && s.steps[s.lock]?.locks ? { ...values, ...s.steps[s.lock].locks } : values,
          steps: s.steps,
          ...(t.before ? { before: t.before } : {}),
          ...(t.note ? { note: t.note } : {}),
          infos,
        };
      }
    }
    // Un encodeur tenu sans tourner (2026-10-09) : sa bulle reste apres l'echo, on lit sa valeur tant qu'on le tient
    if (!pop && this.heldFx.size) {
      const k = [...this.heldFx.keys()][0];
      pop = { k, id: BASS_FX_KNOBS[k] };
    }
    const m: BassPageModel = bassPageModel({
      steps: s.steps,
      values,
      page,
      screen,
      sel: s.sel,
      lock: s.lock,
      running: s.running,
      playing: this.stepAt,
      bpm,
      pattern: `A${String(p.cur + 1).padStart(2, '0')}`,
      preset: presets.current('bass'),
      take: bassTakeName(),
      message: s.message,
      infos,
      echo,
      noteName: (st) => noteName(midiOf(st)),
      midiOf: (st) => midiOf(st),
      held: [...this.heldBlocks.keys()],
      hover: this.hoverBlock,
      pop,
      phone: PORTRAIT,
    });
    return { view: 'page', m, hoverTab: this.hoverChip };
  }

  /** La bande des touches du pas (2026-10-09, le soir) : le pas qu'elles reglent, ce qu'il porte, celles qu'on presse. */
  private keysView(): BassKeysModel {
    const s = bassState.get();
    const held = BASS_SCREEN_KEY_KINDS.filter((k) => this.held.has(bassKeyId(k)));
    return bassKeysModel({ steps: s.steps, sel: s.sel, lock: s.lock, noteName: (st) => noteName(midiOf(st)), held });
  }

  private drawScreen(): boolean {
    this.drawQueued = false;
    const sv = this.screenView();
    this.shown = sv;
    const kv = this.keysView();
    this.band = kv;
    const drawn = this.screen.draw(sv, kv);
    // L'ecran existe pour de bon (2026-10-09, la revue : le message de la migration du son d'avant passait pendant le
    // chargement de la scene) : state/presets.ts peut le dire, au premier coup d'oeil sur le MM-BASS
    if (drawn && !this.screenUp) {
      this.screenUp = true;
      presets.bassScreenUp();
    }
    // Les zones de l'en-tete (la pastille P-LOCK, au telephone les onglets) et le rouleau d'EDIT suivent ce qui vient
    // d'etre dessine (2026-10-09)
    if (drawn) {
      const head = this.syncHead();
      if (this.syncRoll() || head) this.opts.hitChanged();
    }
    return drawn;
  }

  /**
   * Un dessin de l'ecran a la fin du geste (2026-10-08, la revue : un potard qui tourne notifiait les reglages puis
   * l'etat, deux ou trois dessins complets par mouvement) : les notifications d'une meme tache n'en font qu'un.
   */
  private queueDraw(): void {
    if (this.drawQueued) return;
    this.drawQueued = true;
    queueMicrotask(() => {
      if (!this.drawQueued) return;
      if (this.drawScreen()) this.opts.repaint();
    });
  }

  /**
   * Un bloc de l'ecran (ou son encodeur, desktop) pris ou lache par un pointeur (2026-10-09, la machine sans encodeurs
   * du telephone) : tant qu'il est tenu, l'ecran le cerne, on voit ce que le doigt regle avant meme que la valeur bouge.
   */
  /** Un potard dedie pris ou lache (2026-10-09, la revue) : son echo reste a l'ecran tant qu'il est tenu. */
  holdPot(id: BassKnobId, down: boolean): void {
    const n = (this.heldPots.get(id) ?? 0) + (down ? 1 : -1);
    if (n > 0) this.heldPots.set(id, n);
    else {
      this.heldPots.delete(id);
      if (!down) this.potUp = { id, at: performance.now() };
    }
    this.queueDraw();
  }

  holdBlock(k: number, down: boolean, fx = false): void {
    if (k < 0 || k > 7) return;
    const held = fx ? this.heldFx : this.heldBlocks;
    const n = (held.get(k) ?? 0) + (down ? 1 : -1);
    if (n > 0) held.set(k, n);
    else held.delete(k);
    this.queueDraw();
  }

  pressKey(id: string, down: boolean): void {
    if (down) this.held.add(id);
    else this.held.delete(id);
    const k = BASS_KEYS.findIndex((x) => bassKeyId(x.kind) === id);
    let moved = false;
    if (k >= 0) {
      this.keyY[k] = down ? -DJ_KEY.press : 0;
      this.placeKey(k);
      moved = true;
    }
    if (id.startsWith('bass-trig-')) {
      const i = Number(id.slice(10)) - 1;
      if (i >= 0 && i < BASS_STEPS) {
        this.trigY[i] = down ? -DJ_KEY.press : 0;
        this.placeTrig(i);
        moved = true;
      }
    }
    if (id.startsWith('bass-lock-')) {
      const i = Number(id.slice(10)) - 1;
      if (i >= 0 && i < BASS_STEPS) {
        this.lockY[i] = down ? -DJ_KEY.press * 0.8 : 0;
        this.placeLock(i);
        moved = true;
      }
    }
    // Une touche du pas (2026-10-09, le soir) : sur l'ecran, cernee tant qu'on la presse
    if (id.startsWith('bass-key-') && isBassScreenKey(id.slice('bass-key-'.length))) this.queueDraw();
    const lit = this.syncLights();
    if (moved && this.keys.castShadow) this.opts.invalidate();
    else if (moved || lit) this.opts.repaint();
  }

  /**
   * L'animateur : la tete de lecture (les LED, l'ecran qui suit le pas qui
   * joue, ses verrous en negatif) ; 'paint' tant que la basse joue. L'ecran
   * ne se redessine qu'au changement de pas (2026-10-08 : plus a chaque
   * rapport du worklet, la texture part au GPU a chaque fois).
   */
  step = (): 'paint' | 'poll' | false => {
    if (!this.root.visible) return false;
    let changed = false;
    const at = bassSeq.running ? bassSeq.stepAt(bassSeq.now()) : -1;
    // LOCK : le pas regle clignote (une image de plus tant qu'on regle)
    const locking = bassState.get().lock >= 0;
    const blink = !locking || performance.now() % BLINK.period < BLINK.period * BLINK.on;
    if (at !== this.stepAt || blink !== this.blink) {
      const stepped = at !== this.stepAt;
      this.stepAt = at;
      this.blink = blink;
      if (this.syncLights()) changed = true;
      if (stepped && this.drawScreen()) changed = true;
    }
    // LOCK a l'arret : relu a chaque image pour le clignotement, rendu seulement quand il change
    return bassSeq.running || changed ? 'paint' : locking ? 'poll' : false;
  };

  /* ---------- OPEN ---------- */

  private syncExplode = (): void => {
    this.applyExplode(false);
    const lit = this.syncLights();
    if (this.syncHood()) this.opts.hitChanged();
    if (lit) this.opts.repaint();
  };

  /**
   * Le capot (store bassExplode) : opening ou closing lance l'animation
   * (l'etat final a la frame suivante en mouvement reduit), open et closed
   * sont poses par l'animation (settle) ; instant : l'etat pose tout de
   * suite (le rig arrive).
   */
  private applyExplode(instant: boolean): void {
    const s = bassExplode.get();
    const goal = s === 'opening' || s === 'open';
    if (instant) {
      this.explodeGoal = goal;
      if (goal) this.pcb.prepare();
      this.explode.snap(goal);
      if (s === 'opening' || s === 'closing') bassExplode.settle(goal);
      this.opts.invalidate();
      return;
    }
    if (goal === this.explodeGoal) return;
    this.explodeGoal = goal;
    // Le capot s'ouvre : la musique est programmee d'avance, la carte prend ses textures (premiere fois)
    if (goal) {
      reserve(1.2);
      this.pcb.prepare();
    }
    if (s === 'opening' || s === 'closing') this.explode.start(goal, performance.now(), this.opts.reduced());
    else this.explode.snap(goal);
    this.opts.invalidate();
  }

  /** Le capot qui s'ouvre ou se ferme ; true tant qu'il bouge (les potards de la plaque s'allument en chemin). */
  stepExplode = (now: number): boolean => {
    const moving = this.explode.update(now);
    if (this.syncHood()) this.opts.hitChanged();
    return moving;
  };

  listen(): void {
    this.unsubs.push(bassExplode.subscribe(this.syncExplode));
    this.applyExplode(true);
    if (this.syncHood()) this.opts.hitChanged();
    this.detach = bassExplode.attach();
    const all = (): void => {
      const lit = this.syncLights();
      const moved = this.syncKnobs();
      this.queueDraw();
      if (moved && this.knobs.castShadow) this.opts.invalidate();
      else if (lit || moved || bassState.get().running) this.opts.repaint();
    };
    this.unsubs.push(
      bassState.subscribe(all),
      bassPage.subscribe(all),
      bassPatterns.subscribe(() => {
        const lit = this.syncLights();
        if (this.drawScreen() || lit) this.opts.repaint();
      }),
      editor.subscribe(() => {
        if (this.syncScreenKeys()) this.opts.hitChanged();
        const lit = this.syncLights();
        if (this.drawScreen() || lit) this.opts.repaint();
      }),
      presetMode.subscribe(() => {
        if (this.syncScreenKeys()) this.opts.hitChanged();
        // La LED de PRESET (2026-10-09, le soir)
        const lit = this.syncLights();
        if (this.drawScreen() || lit) this.opts.repaint();
      }),
      presets.subscribe(() => {
        if (this.drawScreen()) this.opts.repaint();
      }),
      bassInfos.subscribe(() => {
        if (this.drawScreen()) this.opts.repaint();
      }),
      bassParams.subscribe(() => {
        const moved = this.syncKnobs();
        this.queueDraw();
        if (moved && this.knobs.castShadow) this.opts.invalidate();
        else if (moved) this.opts.repaint();
      }),
      pattern.subscribe(() => {
        if (this.drawScreen()) this.opts.repaint();
      })
    );
    void whenFonts().then(() => this.redrawText());
  }

  redrawText(): void {
    this.silk.draw();
    this.pcb.redraw();
    this.tweaks.draw();
    this.screen.invalidate();
    this.drawScreen();
    this.opts.repaint();
  }

  /**
   * Le survol : INFOS (2026-10-08) montre la carte de la commande survolee ; desktop (2026-10-09, l'etape 2 : l'ecran se
   * regle a la souris) le bloc de l'ecran survole se cerne a peine, comme la colonne du rouleau d'EDIT (rollHover).
   */
  setHover(id: string | null): boolean {
    bassInfos.hover(id && id.startsWith('bass-') ? id : null);
    const m = id ? /^bass-blk-(\d)$/.exec(id) : null;
    const k = m ? Number(m[1]) - 1 : -1;
    if (k !== this.hoverBlock) {
      this.hoverBlock = k;
      this.queueDraw();
    }
    // Une puce d'onglet survolee (2026-10-09, desktop) : un cadre a peine
    const c = id ? /^bass-scr-([a-z]+)$/.exec(id) : null;
    const chip = c && (BASS_SCREENS as readonly string[]).includes(c[1]) ? (c[1] as BassScreenId) : null;
    if (chip !== this.hoverChip) {
      this.hoverChip = chip;
      this.queueDraw();
    }
    if (id !== BASS_ROLL_ID && this.hoverRoll >= 0) {
      this.hoverRoll = -1;
      this.queueDraw();
    }
    return false;
  }

  /** La colonne du rouleau d'EDIT sous la souris (bass/gestures.ts la calcule du pointeur), -1 : aucune. */
  rollHover(step: number): void {
    if (step === this.hoverRoll) return;
    this.hoverRoll = step;
    this.queueDraw();
  }

  /** La note qu'on glisse au rouleau d'EDIT (2026-10-09) : l'ecran la cerne et la nomme ; null au lacher. */
  rollDragging(d: { step: number; name: string; lo?: number; hi?: number } | null): void {
    if (d?.step === this.rollDrag?.step && d?.name === this.rollDrag?.name) return;
    this.rollDrag = d;
    this.queueDraw();
  }

  /**
   * Le curseur d'une zone du MM-BASS (2026-10-09, l'etape 2 : l'ecran se regle a la souris) : un bloc de l'ecran qui
   * porte un reglage et le rouleau d'EDIT se glissent de haut en bas (ns-resize) ; null : le curseur ordinaire (le
   * doigt). Les encodeurs gardent le doigt (2026-10-03, Mika : pas de doubles fleches sur un potard).
   */
  cursor(id: string): string | null {
    if (id === BASS_ROLL_ID) return 'ns-resize';
    // Le verre qui ne fait rien (l'en-tete autour des onglets, la ligne du titre, sous les blocs) : le curseur ordinaire
    // (la revue du 2026-10-09 : l'en-tete du desktop a ses zones)
    if (id.startsWith('bass-lcd-head-') || id === 'bass-lcd-title' || id === 'bass-lcd-glass' || id === 'bass-lcd-glass-edit' || id === 'bass-lcd-glass-keys') return 'default';
    const m = /^bass-blk-(\d)$/.exec(id);
    if (!m) return null;
    const shown = this.shown;
    if (!shown || shown.view !== 'page') return null;
    const b = shown.m.blocks[Number(m[1]) - 1];
    return b && b.id ? 'ns-resize' : null;
  }

  /** L'ecran : le verre et ses zones (bass/gestures.ts y projette un pointeur, le rouleau d'EDIT). */
  screenCorners(): number[][] {
    const S = BASS.screen;
    const y = DJ_BEZEL.h + 0.003;
    const x0 = S.x - S.w / 2;
    const z0 = S.z - S.d / 2;
    return [
      [x0, y, z0],
      [x0 + S.w, y, z0],
      [x0 + S.w, y, z0 + S.d],
      [x0, y, z0 + S.d],
    ];
  }

  info(): { knobs: number; encoders: number; plate: number; keys: number; trigs: number; locks: number; screenDraws: number; silkDraws: number; encAngleDeg: number[]; screen: BassScreenView | null; band: BassKeysModel | null; explode: ExplodeInfo } {
    // Un dessin attendu (queueDraw) : fait tout de suite, ce qu'on lit est ce que l'ecran montre
    if (this.drawQueued && this.drawScreen()) this.opts.repaint();
    return {
      knobs: BASS_KNOBS.length,
      encoders: BASS_ENC_N,
      plate: BASS_PLATE_KNOBS.length,
      keys: BASS_KEYS.length,
      trigs: BASS_STEPS,
      locks: BASS_STEPS,
      screenDraws: this.screen.draws,
      silkDraws: this.silk.draws,
      encAngleDeg: Array.from(this.encAngle.subarray(0, BASS_ENC_N), (a) => Math.round((a * 180) / Math.PI)),
      screen: this.shown,
      band: this.band,
      explode: this.explode.info(),
    };
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.detach();
    this.drawQueued = false;
    window.clearTimeout(this.echoTimer);
    this.body.geometry.dispose();
    this.lid.geometry.dispose();
    this.pcb.dispose();
    this.tweaks.dispose();
    this.bodyMat.dispose();
    this.brush.dispose();
    for (const m of this.meshes()) {
      m.geometry.dispose();
      m.dispose();
    }
    for (const m of this.materials) m.dispose();
    this.screen.dispose();
    this.silk.dispose();
  }
}
