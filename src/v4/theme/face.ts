/**
 * La partie face du theme (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) : ENCODER, KNOB_RING, FACE_KEY, FACE_KEYS,
 * TRANSPORT, KEYS, PAGE_KNOBS, FACE_KNOBS, PAGE_KEYS, KEY_LABELS, FACE_TITLE, SILK_TEXTS, TWIN_ARIA (et leurs aides),
 * deplaces tels quels de theme.ts, qui les re-exporte (export *). Elle ne lit que theme/base.ts, jamais theme.ts.
 */

import { fwText } from '../firmware';
import { DT2_FACEPLATE, RYTM_FACEPLATE, dt2StepRect, fpU, fpX, fpZ, rectCenter, stepRect } from '../rytm/faceplate';
import type { Dt2KeyClass } from '../rytm/dtFaceIds';
import { DT2_FACE, type EncPlace, type FaceKeyId, faceKeyX, type FaceKnobId, FP_KNOBS, FP_OPEN, FP_STEPS, GLOBAL_ENC_LABELS, GLOBAL_FX_RULE, HEAD, KEY_MARK, type KeyLabelSpec, OLED, PAD, PAD_FACE, padLabel, PADS, PAGE_KEYS_PHONE_W, PAGE_KEYS_PHONE_Z, PAGE_KNOB_IDS, PAGE_KNOB_LETTERS, pageKnobRow, pageKnobX, PORTRAIT, RYTM_FACE_VER, RYTM_PAGE_KEYS, SCENE_KEY, SILK, type SilkText } from './base';

/** La face DT2 (V.6.0, ?face=dt2) : ses donnees en mm (rytm/faceplate.ts), lues seulement derriere DT2_FACE. */
const DT2 = DT2_FACEPLATE;

export const ENCODER = PORTRAIT || PAD_FACE
  ? ({
      r: 0.27,
      rTop: 0.256,
      h: 0.42,
      /** rayon de mise en page a la base (libelles, crochets) */
      collar: { r: 0.32, h: 0.025 },
      /** jupe d'aluminium (2026-10-03, celle des potards du MM-VOYAGER) : un filet fin, biseaute */
      skirt: { r: 0.298, rTop: 0.287, h: 0.04 },
      mark: { w: 0.036, h: 0.012, d: 0.18 },
      /**
       * 2026-10-22 (audit, les potards du RYTM etaient les plus pauvres de la table : un cylindre noir lisse) : un chanfrein
       * en haut (chamfer, un peu plus clair : il accroche la lumiere) et des cannelures sur le flanc, comme le MM-ARP
       * (flutes, leur creux fluteDepth) ; assez de segments pour elles (trois par cannelure au desktop)
       */
      chamfer: 0.026,
      chamferGain: 3.4,
      flutes: 20,
      fluteDepth: 0.008,
      segments: { desktop: 60, mobile: 40 },
      voiceScale: 0.85,
    } as const)
  : // La face DT2 (V.6.0, ?face=dt2) : les potards de 24 (capuchon 14.5 / 13.6 / 7), leur repere un rien plus court
    ({
      r: fpU(FP_KNOBS.cap.d / 2),
      rTop: fpU(FP_KNOBS.cap.top / 2),
      h: fpU(FP_KNOBS.cap.h),
      collar: { r: fpU(FP_KNOBS.skirt.d / 2), h: 0.025 },
      skirt: { r: fpU(FP_KNOBS.skirt.d / 2), rTop: DT2_FACE ? fpU(FP_KNOBS.skirt.d / 2) - 0.015 : 0.45, h: fpU(FP_KNOBS.skirt.h) },
      mark: { w: 0.05, h: 0.012, d: DT2_FACE ? 0.26 : 0.3 },
      chamfer: 0.04,
      chamferGain: 3.4,
      flutes: 28,
      fluteDepth: 0.012,
      segments: { desktop: 84, mobile: 56 },
      voiceScale: 0.85,
    } as const);

/**
 * L'anneau de valeur des potards de la face V.4.0 (2026-10-27, Mika : "chaque potard a un anneau de valeur, la machine
 * aura des potards motorises qui suivent la valeur") : 27 segments a plat autour du capuchon, sur les 270 deg de la
 * course (7 h 30 a 4 h 30, comme le repere), un rayon de r0 a r1 (rytm/faceplate.ts knobs.ring), airDeg d'air entre
 * deux segments, y au-dessus du panneau (la serigraphie est a 0.004). Un segment s'allume a l'orange des pas mis, le
 * dernier en partie (le mouvement reste doux) ; un potard a zero au centre (STRETCH) s'allume du centre a la valeur, son
 * segment du milieu toujours a center (il dit ou est le zero).
 */
// La face DT2 (V.6.0, ?face=dt2) : l'anneau de 19.8 a 23.2 (FP_KNOBS, la face lue)
export const KNOB_RING = {
  r0: fpU(FP_KNOBS.ring.inner / 2),
  r1: fpU(FP_KNOBS.ring.outer / 2),
  segments: FP_KNOBS.ring.segments,
  airDeg: FP_KNOBS.ring.airDeg,
  y: 0.006,
  center: 0.35,
  /** les scenes (2026-10-27, la phase 2) : les segments eteints entre la course de A et celle de B luisent a cette part */
  band: 0.18,
} as const;

/**
 * RUN/STOP, CLEAR, RANDOM, MUTE et SOLO (2026-10-01) : boutons carres de
 * 0.8 (0.62 avant, environ 30 px de plus a l'ecran), sous l'ecran, alignes
 * sur le bord gauche de son cadre (x -5.88), pas de 1.0 ; libelles 0.58
 * sous leur centre, comme les pads. Remontes de 0.06 le 2026-10-01 : la
 * rangee GLOBAL est dessous (TEMPO garde 0.1 au-dessus de SOLO). RANDOM tire un motif house
 * (audio/house.ts). MUTE coupe la voix selectionnee, SOLO ne laisse jouer
 * qu'elle (state/voices.ts).
 */
/**
 * La rangee des touches de la face V.4.0 (2026-10-27, Mika : "une rangee de 12 boutons pictogrammes 12 x 12 en y 84,
 * x = 8 + 14 i ; SCENE A et B, le crossfader entre elles") : la forme des touches de page (meme matiere, meme hauteur),
 * carrees de 12 mm, leur temoin pres du bord arriere ; faceKeyX(i), le centre de la touche i (0 TRK a 11 SOLO,
 * rytm/faceplate.ts). FACE_KEYS : celles de scene/rytmFaceKeys.ts (TRK, EDIT, OPEN, SCENE A et B) ; XFADE : la fente
 * (fusionnee au panneau, machine.ts) et le capuchon du crossfader, au milieu de sa course en phase 1. Le desktop
 * seulement : le telephone garde sa face (phase 5).
 */
// La hauteur, les coins et le temoin depuis RYTM_FACEPLATE.buttons (2026-10-27, la revue : en mm, comme le reste)
// V.5.0 (2026-10-29) : 10.4 x 12 (w, h), la largeur et la profondeur separees ; SCENE A et B gardent leurs 12 x 12
/*
 * La face DT2 (V.6.0, ?face=dt2, cahier 2.2) : trois classes de touches (P 12 x 11, L 22 x 11, G 26 x 11, FACE_KEY_CLASS),
 * chacune sa place (FACE_KEYS : x, z, w, d par touche) ; le relief, les coins, la course et le temoin de la V.5.3. FACE_KEY
 * y garde la petite touche (P) et le z de la rangee YES / menus (plus lu en 3D : chaque touche a le sien).
 */
export const FACE_KEY = DT2_FACE
  ? ({
      w: fpU(DT2.buttons.sizes.P.w),
      d: fpU(DT2.buttons.sizes.P.h),
      h: fpU(DT2.buttons.capHeight),
      radius: fpU(DT2.buttons.corner),
      bevel: fpU(DT2.buttons.bevel),
      travel: fpU(DT2.buttons.travel),
      z: fpZ(83.5),
      led: { w: fpU(DT2.buttons.led.w), d: fpU(DT2.buttons.led.h), back: fpU(DT2.buttons.led.dy) },
    } as const)
  : ({
      w: fpU(RYTM_FACEPLATE.buttons.w),
      d: fpU(RYTM_FACEPLATE.buttons.h),
      h: fpU(RYTM_FACEPLATE.buttons.capHeight),
      radius: fpU(RYTM_FACEPLATE.buttons.corner),
      /** V.4.2 (2026-10-27) : le chanfrein du dessus et la course de l'appui (scene/keyCap.ts) */
      bevel: fpU(RYTM_FACEPLATE.buttons.bevel),
      travel: fpU(RYTM_FACEPLATE.buttons.travel),
      z: fpZ(RYTM_FACEPLATE.buttons.y + RYTM_FACEPLATE.buttons.h / 2),
      led: { w: fpU(RYTM_FACEPLATE.buttons.led.w), d: fpU(RYTM_FACEPLATE.buttons.led.h), back: fpU(RYTM_FACEPLATE.buttons.led.dy) },
    } as const);
/** La classe d'une touche de la face : row (la rangee de la V.5.3), scene (SCENE A et B), ou P, L, G (la face DT2). */
export type FaceKeyClass = 'row' | 'scene' | Dt2KeyClass;
/** La taille (unites) de chaque classe de touches de la face DT2 (un InstancedMesh par classe, scene/rytmFaceKeys.ts). */
export const FACE_KEY_CLASS: Readonly<Record<Dt2KeyClass, { readonly w: number; readonly d: number }>> = {
  P: { w: fpU(DT2.buttons.sizes.P.w), d: fpU(DT2.buttons.sizes.P.h) },
  L: { w: fpU(DT2.buttons.sizes.L.w), d: fpU(DT2.buttons.sizes.L.h) },
  G: { w: fpU(DT2.buttons.sizes.G.w), d: fpU(DT2.buttons.sizes.G.h) },
};
/**
 * Les touches de la face, chacune sa place (x, z son centre, w x d sa taille, cls sa classe) et l'id de sa zone. V.5.3 :
 * les quatorze de la rangee (un z, la taille FACE_KEY), SCENE A et B (SCENE_KEY ; d : celui de la rangee, la meme). DT2
 * (V.6.0, ?face=dt2) : les 25 touches dans l'ordre de lecture de la face (rytm/dtFaceIds.ts DT2_BUTTONS), sans les scenes.
 */
export const FACE_KEYS: readonly { id: FaceKeyId; x: number; z: number; w: number; d: number; cls: FaceKeyClass; hotspot: string }[] = DT2_FACE
  ? DT2.buttons.keys.map((b) => {
      const c = rectCenter(b.rect);
      return { id: b.id, x: c.x, z: c.z, w: fpU(b.rect.w), d: fpU(b.rect.h), cls: b.cls, hotspot: b.hotspot };
    })
  : [
      ...RYTM_FACEPLATE.buttons.keys.map((b, i) => ({ id: b.id as FaceKeyId, x: faceKeyX(i), z: FACE_KEY.z, w: FACE_KEY.w, d: FACE_KEY.d, cls: 'row' as const, hotspot: b.hotspot })),
      { id: 'scene-a', x: rectCenter(RYTM_FACEPLATE.scenes.a.rect).x, z: FACE_KEY.z, w: SCENE_KEY.w, d: FACE_KEY.d, cls: 'scene', hotspot: RYTM_FACEPLATE.scenes.a.hotspot },
      { id: 'scene-b', x: rectCenter(RYTM_FACEPLATE.scenes.b.rect).x, z: FACE_KEY.z, w: SCENE_KEY.w, d: FACE_KEY.d, cls: 'scene', hotspot: RYTM_FACEPLATE.scenes.b.hotspot },
    ];

/** MAIN VOLUME et LEVEL/DATA (V.6.0, ?face=dt2, cahier 2.2, scene/sideKnobs.ts) en unites : centre, capuchon, jupe, anneau. */
export interface SideKnobSpec {
  id: 'mvol' | 'data';
  x: number;
  z: number;
  /** le rayon de la zone (l'emprise) */
  hitR: number;
  cap: { r: number; rTop: number; h: number };
  skirt: { r: number; rTop: number; h: number };
  ring: { r0: number; r1: number; segments: number; airDeg: number };
  mark: boolean;
  title: string;
}
export const SIDE_KNOBS: readonly SideKnobSpec[] = DT2_FACE
  ? DT2.side.knobs.map((s) => ({
      id: s.id,
      x: fpX(s.cx),
      z: fpZ(s.cy),
      hitR: fpU(s.d / 2) - 0.02,
      cap: { r: fpU(s.cap.d / 2), rTop: fpU(s.cap.top / 2), h: fpU(s.cap.h) },
      skirt: { r: fpU(s.skirt.d / 2), rTop: fpU(s.skirt.d / 2) - 0.015, h: fpU(s.skirt.h) },
      ring: { r0: fpU(s.ring.inner / 2), r1: fpU(s.ring.outer / 2), segments: s.ring.segments, airDeg: s.ring.airDeg },
      mark: s.mark,
      title: s.title,
    }))
  : [];

/**
 * Les 8 LED de page de la face DT2 (V.6.0, ?face=dt2, cahier 2.2 et 2.4) en unites : la fenetre sombre (son centre, sa
 * taille, ses coins) et chaque LED (x, z, rayon), 1 a 4 en haut, 5 a 8 dessous. null : la face de la V.5.3.
 */
export const PAGE_LEDS = DT2_FACE
  ? {
      window: { x: fpX(DT2.pageLeds.window.x + DT2.pageLeds.window.w / 2), z: fpZ(DT2.pageLeds.window.y + DT2.pageLeds.window.h / 2), w: fpU(DT2.pageLeds.window.w), d: fpU(DT2.pageLeds.window.h), r: fpU(DT2.pageLeds.corner) },
      r: fpU(DT2.pageLeds.d / 2),
      leds: DT2.pageLeds.cy.flatMap((cy) => DT2.pageLeds.cx.map((cx) => ({ x: fpX(cx), z: fpZ(cy) }))),
    }
  : null;

/*
 * Sous les pads depuis le 2026-10-08 (la refonte facon Digitakt : sous
 * l'ecran, les huit potards de page et les touches de page ; Mika : "RYTM :
 * je ne vois AUCUN changement de ce que j'ai demande") : un bouton sous
 * chaque colonne de pads (RUN sous BD et CP ... SOLO sous EDIT et OPEN),
 * a la place de la rangee VOICE FX ; au telephone, sous les pads, un peu
 * plus petits.
 */
/*
 * Desktop : 0.25 plus bas le 2026-10-09 avec les pads (MASTER et TEMPO au-dessus des voix ; dans l'ecran depuis le
 * 2026-10-19). Telephone, 2026-10-19 : 0.94 plus bas avec les pads (les encodeurs GLOBAL FX au-dessus d'eux), la
 * premiere rangee de pas presque a sa place (ses LED parties) ; la zone un peu moins haute (hitD 0.84, 36 px), elle
 * s'arrete au bord des pas.
 */
/*
 * La forme des touches de page depuis le 2026-10-18 (Mika : "j'aime le format
 * des boutons VOICE et FLTR etc. ; je veux la meme forme de boutons pour les
 * boutons RUN/STOP CLEAR etc.") : plus des carres de 0.8, des touches plates a
 * coins arrondis comme PAGE_KEYS (meme matiere, meme hauteur, meme arrondi, le
 * meme temoin pres du bord arriere), w x d : 1.0 x 0.38 au desktop (le pas de
 * 1.25 des colonnes de pads reste), 1.14 x 0.44 au telephone (cinq touches sur
 * sa largeur, au pas de 1.3). Leur nom est imprime dessus (KEY_LABELS), plus
 * dessous ; RUN/STOP garde son rouge. Leur centre ne bouge pas. hitD : la
 * profondeur de leur zone (au telephone 0.9, environ 40 px au doigt ; la
 * touche seule au desktop, la souris).
 */
/*
 * La face V.4.0 du desktop (2026-10-27) : RUN/STOP CLEAR RANDOM MUTE SOLO sont les touches 8 a 12 de la rangee (FACE_KEY,
 * faceKeyX 7 a 11), 12 x 12 mm, leur legende dessus (KEY_LABELS ; V.4.2 : leur nom, les signes PLAY et STOP sur
 * RUN/STOP) ; RUN/STOP garde son rouge.
 */
export const TRANSPORT = {
  w: PORTRAIT ? 1.14 : PAD_FACE ? 1.0 : FACE_KEY.w,
  d: PORTRAIT ? 0.44 : PAD_FACE ? 0.38 : FACE_KEY.d,
  h: PORTRAIT || PAD_FACE ? 0.1 : FACE_KEY.h,
  radius: PORTRAIT || PAD_FACE ? 0.05 : FACE_KEY.radius,
  z: PORTRAIT ? 3.56 : PAD_FACE ? 0.71 : FACE_KEY.z,
  hitD: PORTRAIT ? 0.84 : PAD_FACE ? 0.38 : FACE_KEY.d,
  /** le temoin, celui des touches de page (a la largeur de la touche) */
  led: PORTRAIT || PAD_FACE ? { w: 0.62, d: 0.05, back: 0.11 } : FACE_KEY.led,
  run: { x: PORTRAIT ? -2.6 : PAD_FACE ? PAD.x0 : faceKeyX(7) },
  clear: { x: PORTRAIT ? -1.3 : PAD_FACE ? PAD.x0 + PAD.pitch : faceKeyX(8) },
  random: { x: PORTRAIT ? 0 : PAD_FACE ? PAD.x0 + 2 * PAD.pitch : faceKeyX(9) },
  mute: { x: PORTRAIT ? 1.3 : PAD_FACE ? PAD.x0 + 3 * PAD.pitch : faceKeyX(10) },
  solo: { x: PORTRAIT ? 2.6 : PAD_FACE ? PAD.x0 + 4 * PAD.pitch : faceKeyX(11) },
} as const;
export const KEYS = {
  count: 16,
  x0: PORTRAIT ? -3.01 : PAD_FACE ? -5.625 : fpX(FP_STEPS.x0 + FP_STEPS.w / 2),
  pitch: PORTRAIT ? 0.86 : PAD_FACE ? 0.75 : fpU(FP_STEPS.pitch),
  z: PORTRAIT ? 4.36 : PAD_FACE ? 2.38 : fpZ(FP_STEPS.rows[0] + FP_STEPS.h / 2),
  /** portrait : deux rangees de 8, la seconde rowDz plus bas ; V.1.0-V.3.0 : une rangee de 16 ; le desktop depuis V.4.0 : deux rangees de 8 */
  perRow: PORTRAIT ? 8 : PAD_FACE ? 16 : FP_STEPS.perRow,
  rowDz: PORTRAIT ? 1.52 : PAD_FACE ? 0 : fpU(FP_STEPS.rows[1] - FP_STEPS.rows[0]),
  w: PORTRAIT ? 0.7 : PAD_FACE ? 0.62 : fpU(FP_STEPS.w),
  d: PORTRAIT ? 0.7 : PAD_FACE ? 0.62 : fpU(FP_STEPS.h),
  // desktop : la hauteur, les coins, le cadre des temps et la marque des verrous depuis RYTM_FACEPLATE.steps (2026-10-27)
  h: PORTRAIT || PAD_FACE ? 0.1 : fpU(FP_STEPS.capHeight),
  radius: PORTRAIT || PAD_FACE ? 0.05 : fpU(FP_STEPS.corner),
  /** V.4.2 (2026-10-27) : le chanfrein du dessus au desktop (scene/keyCap.ts ; le telephone garde ses touches arrondies) */
  bevel: PORTRAIT || (PAD_FACE && RYTM_FACE_VER !== '3.0') ? 0 : fpU(FP_STEPS.bevel),
  segments: { desktop: 3, mobile: 2 },
  /** le cadre des temps (1, 5, 9, 13), imprime sur le dessus de la touche, facon Elektron : sa marge, son trait */
  frame: PORTRAIT || PAD_FACE ? { inset: 0.065, line: 0.022 } : { inset: fpU(FP_STEPS.beatFrame.inset), line: fpU(FP_STEPS.beatFrame.line) },
  lockMark: PORTRAIT || PAD_FACE ? { w: 0.3, d: 0.05, back: 0.135 } : { w: fpU(FP_STEPS.lockMark.w), d: fpU(FP_STEPS.lockMark.h), back: fpU(FP_STEPS.lockMark.dy) },
  numberZ: PORTRAIT ? 4.94 : PAD_FACE ? 2.86 : 3.7,
  bracketZ: PORTRAIT ? 5.11 : PAD_FACE ? 3.01 : 3.45,
  bracketTick: 0.06,
} as const;
/** x du pas i ; sa rangee le decale de keyDz en z (portrait : deux rangees de 8). */
export const keyX = (i: number): number => KEYS.x0 + KEYS.pitch * (i % KEYS.perRow);
export const keyDz = (i: number): number => KEYS.rowDz * Math.floor(i / KEYS.perRow);

export const PAGE_KNOBS = PORTRAIT
  ? ({ rowZ: [GLOBAL_FX_RULE.z + 0.72, GLOBAL_FX_RULE.z + 1.88], s: 1.05, pitch: 0, cap: 0.1, nameDz: -0.52, hitD: 1.16, hitUp: 0.67, hitW: 1.78, hitR: 0, labelW: 1.78 - 0.2 } as const)
  : PAD_FACE && RYTM_FACE_VER === '1.0'
    ? ({ rowZ: [GLOBAL_FX_RULE.z + 0.52, GLOBAL_FX_RULE.z + 1.34], s: 0.88, pitch: 0, cap: 0.072, nameDz: -0.42, hitD: 0.82, hitUp: 0.46, hitW: 1.25, hitR: 0, labelW: 1.05 } as const)
    : PAD_FACE
      ? ({ rowZ: [GLOBAL_FX_RULE.z + 0.62, GLOBAL_FX_RULE.z + 0.62], s: 0.85, pitch: 0.66, cap: 0.065, nameDz: -0.39, hitD: 0.85, hitUp: 0.48, hitW: 0.66, hitR: 0, labelW: 0.62 } as const)
      : // La face DT2 (V.6.0, ?face=dt2) : FP_KNOBS (24 d'emprise, au pas de 80 / 3, la lettre a 10.6 mm du centre)
        ({
          rowZ: [fpZ(FP_KNOBS.cy[0]), fpZ(FP_KNOBS.cy[1])],
          s: 1,
          pitch: fpU(FP_KNOBS.pitch),
          cap: fpU(FP_KNOBS.label.cap),
          nameDz: fpU(FP_KNOBS.label.r),
          hitD: 0,
          hitUp: 0,
          hitW: 0,
          hitR: fpU(FP_KNOBS.d / 2) - 0.02,
          labelW: DT2_FACE ? 0.7 : 0.8,
        } as const);

/** Les encodeurs de la face, dans l'ordre A a H (le desktop et, depuis le 2026-10-19, le telephone). */
export const FACE_KNOBS: readonly ({ id: FaceKnobId } & EncPlace)[] = PAGE_KNOB_IDS.map((id, k) => ({
  id,
  x: pageKnobX(k),
  z: PAGE_KNOBS.rowZ[pageKnobRow(k)],
  labelZ: PAGE_KNOBS.rowZ[pageKnobRow(k)] + PAGE_KNOBS.nameDz,
  s: PAGE_KNOBS.s,
}));
export const PAGE_KEYS = PORTRAIT
  ? ({
      // Quatre touches depuis le 2026-10-09 : plus larges (1.1 pour six), le meme air entre elles
      w: PAGE_KEYS_PHONE_W,
      d: 0.44,
      h: 0.1,
      radius: 0.05,
      z: PAGE_KEYS_PHONE_Z,
      led: { w: 0.86, d: 0.05, back: 0.11 },
      hitZ0: OLED.z + OLED.d / 2 + 0.002,
      hitZ1: PAGE_KNOBS.rowZ[0] - PAGE_KNOBS.hitUp,
    } as const)
  : PAD_FACE
    ? ({
        w: 1.15,
        d: 0.38,
        h: 0.1,
        radius: 0.05,
        z: OLED.z + OLED.bezel.d / 2 + 0.09 + 0.19,
        led: { w: 0.72, d: 0.05, back: 0.11 },
        hitZ0: OLED.z + OLED.bezel.d / 2 + 0.09,
        hitZ1: OLED.z + OLED.bezel.d / 2 + 0.09 + 0.38,
      } as const)
    : // La face V.4.0 du desktop (2026-10-27) : VOICE FLTR ENV FX sont les touches 2 a 5 de la rangee de la face
      ({ w: FACE_KEY.w, d: FACE_KEY.d, h: FACE_KEY.h, radius: FACE_KEY.radius, z: FACE_KEY.z, led: FACE_KEY.led, hitZ0: FACE_KEY.z - FACE_KEY.d / 2, hitZ1: FACE_KEY.z + FACE_KEY.d / 2 } as const);
/**
 * x de la touche de page k (0 a 3) : quatre touches egales sur la largeur du verre de l'ecran (2026-10-09) ; au desktop
 * depuis le 2026-10-27, les touches 2 a 5 de la rangee de la face (faceKeyX).
 */
export const pageKeyX = (k: number): number => {
  // V.5.0 (2026-10-29) : SRC FLTR AMP FX, les touches 8 a 11 de la rangee (scene/rytmFaceKeys.ts les porte au desktop)
  if (!PORTRAIT && !PAD_FACE) return faceKeyX(7 + k);
  const x0 = OLED.x - OLED.w / 2 + PAGE_KEYS.w / 2;
  const x1 = OLED.x + OLED.w / 2 - PAGE_KEYS.w / 2;
  return x0 + ((x1 - x0) * k) / (RYTM_PAGE_KEYS.length - 1);
};

export const KEY_LABELS: readonly KeyLabelSpec[] = PORTRAIT || PAD_FACE
  ? [
      ...RYTM_PAGE_KEYS.map((pk, k): KeyLabelSpec => ({ id: pk.id, text: pk.label, x: pageKeyX(k), z: PAGE_KEYS.z, w: PAGE_KEYS.w, d: PAGE_KEYS.d, group: 'pkey', rest: 'ink' })),
      ...(
        [
          ['run', 'RUN/STOP'],
          ['clear', 'CLEAR'],
          ['random', 'RANDOM'],
          ['mute', 'MUTE'],
          ['solo', 'SOLO'],
        ] as const
      ).map(([id, text]): KeyLabelSpec => ({ id, text, x: TRANSPORT[id].x, z: TRANSPORT.z, w: TRANSPORT.w, d: TRANSPORT.d, group: 'tr', rest: id === 'run' ? 'bone' : 'ink' })),
    ]
  : DT2_FACE
    ? [
        // La face DT2 (V.6.0, ?face=dt2, cahier 2.3) : un mot sur chaque touche (Mika, V.4.2 : des mots plutot que des
        // pictogrammes), le meme corps pour les 25 (un groupe), dans la largeur de sa touche moins une marge ; les signes du
        // transport et les chevrons des fleches
        ...DT2.buttons.keys.map((b): KeyLabelSpec => {
          const L = DT2.buttons.legend;
          const c = rectCenter(b.rect);
          return {
            id: b.id,
            text: b.legend,
            x: c.x,
            z: c.z,
            w: fpU(b.rect.w),
            d: fpU(b.rect.h),
            group: 'face',
            rest: 'ink',
            ...(b.marks ? { marks: b.marks, dz: KEY_MARK.dz } : { cap: fpU(L.cap), qw: fpU(b.rect.w - 2 * L.margin), dz: fpU(L.dy), tracking: L.tracking }),
          };
        }),
        // Le numero seul sur chaque pas (16 pistes libres, cahier 2.2), en haut a gauche comme avant
        ...Array.from({ length: 16 }, (_, i): KeyLabelSpec => {
          const r = dt2StepRect(i);
          const L = DT2.steps.legend.num;
          const qw = fpU(L.w);
          return { id: `stepn-${i + 1}`, text: String(i + 1), x: fpX(r.x + L.dx) + qw / 2, z: fpZ(r.y + L.dy + L.cap / 2), w: fpU(r.w), d: fpU(r.h), group: 'stepn', rest: 'ink', cap: fpU(L.cap), qw, dz: 0, align: 'left' };
        }),
      ]
    : [
      ...RYTM_FACEPLATE.buttons.keys.map((b, i): KeyLabelSpec => {
        const L = RYTM_FACEPLATE.buttons.legend;
        return {
          id: b.id,
          text: b.legend,
          x: faceKeyX(i),
          z: FACE_KEY.z,
          w: FACE_KEY.w,
          d: FACE_KEY.d,
          group: 'face',
          // V.5.0 (2026-10-29) : plus de touche rouge (RUN/STOP) ; FUNC, orange, garde sa legende noire (rytmFaceKeys.ts)
          rest: 'ink',
          ...(b.marks ? { marks: b.marks, dz: KEY_MARK.dz } : { cap: fpU(L.cap), qw: fpU(L.w), dz: fpU(L.dy), tracking: L.tracking }),
        };
      }),
      ...(['a', 'b'] as const).map(
        (k): KeyLabelSpec => ({
          id: `scene-${k}`,
          text: RYTM_FACEPLATE.scenes[k].letter,
          x: rectCenter(RYTM_FACEPLATE.scenes[k].rect).x,
          z: FACE_KEY.z,
          w: SCENE_KEY.w,
          d: SCENE_KEY.d,
          group: 'scene',
          rest: 'ink',
          cap: fpU(RYTM_FACEPLATE.scenes.legend.cap),
          qw: fpU(RYTM_FACEPLATE.scenes.legend.w),
        })
      ),
      // Les legendes des pas (2026-10-27, Mika : "les pas 1 a 8 portent le nom d'une voix") : le numero en haut a gauche
      // de la touche, cale a gauche ; la voix des pas 1 a 8 en bas au centre (rytm/faceplate.ts steps.legend)
      ...Array.from({ length: 16 }, (_, i): KeyLabelSpec => {
        const r = stepRect(i);
        const L = RYTM_FACEPLATE.steps.legend.num;
        const qw = fpU(L.w);
        return { id: `stepn-${i + 1}`, text: String(i + 1), x: fpX(r.x + L.dx) + qw / 2, z: fpZ(r.y + L.dy + L.cap / 2), w: fpU(r.w), d: fpU(r.h), group: 'stepn', rest: 'ink', cap: fpU(L.cap), qw, dz: 0, align: 'left' };
      }),
      ...RYTM_FACEPLATE.steps.voices.map((v, i): KeyLabelSpec => {
        const r = stepRect(i);
        const L = RYTM_FACEPLATE.steps.legend.voice;
        return { id: `stepv-${v}`, text: v, x: fpX(r.x + r.w / 2), z: fpZ(r.y + L.dy), w: fpU(r.w), d: fpU(r.h), group: 'stepv', rest: 'ink', cap: fpU(L.cap), qw: fpU(L.w), dz: 0 };
      }),
    ];

/**
 * L'infobulle de chaque commande de la face V.4.0 du desktop (2026-10-27, Mika : "le nom complet dans l'infobulle et
 * dans l'aria-label du jumeau") : par id de zone ; TRK, SCENE A et B et le crossfader disent leur geste depuis la phase 2
 * (une touche phase 2 du gabarit dirait coming soon : aucune depuis le 2026-10-27).
 */
/** Le titre d'une touche de la face : coming soon (phase 2), sa fonction orange, ou son nom seul. */
const keyTitle = (b: { title: string; name: string; alt?: string; phase: 1 | 2 }): string =>
  b.phase === 2 ? `${b.title} (${b.name}), coming soon` : b.alt ? `${b.title} (${b.name}); FUNC + ${b.name}: ${b.alt}` : `${b.title} (${b.name})`;

export const FACE_TITLE: Readonly<Record<string, string>> = PORTRAIT
  ? {}
  : DT2_FACE
    ? {
        // La face DT2 (V.6.0, ?face=dt2) : ses 25 touches (les onze nouvelles : coming soon, tant que la lane B4 ne les a pas
        // branchees), MAIN VOLUME et LEVEL/DATA ; TRK, FUNC, le logo M et les potards gardent leur geste d'aujourd'hui
        ...Object.fromEntries(DT2.buttons.keys.map((b) => [b.hotspot, keyTitle(b)])),
        trk: 'Track (TRK): hold, then a step 1-8 picks its voice; tap to latch; FUNC + TRK: MUTE mode',
        func: 'Function (FUNC): tap, then a key for its orange function; hold it for a moment; tap twice to keep it (Alt key)',
        [FP_OPEN.hotspot]: FP_OPEN.title,
        mvol: 'Main volume (MAIN VOLUME): drag or scroll; double-click: back to its start',
        data: 'Level / data (LEVEL/DATA): the level of the track, scrolls the menus; FUNC + LEVEL/DATA: PRESET POOL, coming soon',
        ...Object.fromEntries(PAGE_KNOB_LETTERS.map((l, k) => [`penc-${k}`, `Knob ${l}: the function in the same place on the screen; click: what it opens there`])),
      }
    : {
      ...Object.fromEntries(RYTM_FACEPLATE.buttons.keys.map((b) => [b.hotspot, keyTitle(b)])),
      // TRK agit depuis la phase 2 (2026-10-27) : son geste dans l'infobulle et le jumeau
      trk: 'Track (TRK): hold, then a step 1-8 picks its voice; tap to latch; FUNC + TRK: MUTE mode',
      // V.5.0 (2026-10-29, la face facon Digitakt) : FUNC et ses gestes, le logo M qui ouvre le capot
      func: 'Function (FUNC): tap, then a key for its orange function; hold it for a moment; tap twice to keep it (Alt key)',
      [RYTM_FACEPLATE.open.hotspot]: RYTM_FACEPLATE.open.title,
      // SCENE A et B agissent depuis le 2026-10-27 (P2-19) : tenir ou taper, puis tourner
      [RYTM_FACEPLATE.scenes.a.hotspot]: `${RYTM_FACEPLATE.scenes.a.title}: hold or tap, then turn a knob to record it`,
      [RYTM_FACEPLATE.scenes.b.hotspot]: `${RYTM_FACEPLATE.scenes.b.title}: hold or tap, then turn a knob to record it`,
      // Le crossfader agit depuis P2-20 (2026-10-27)
      [RYTM_FACEPLATE.scenes.xfade.hotspot]: `${RYTM_FACEPLATE.scenes.xfade.title}: drag the cap or scroll over it`,
      // Les potards suivent la page (2026-10-27) : la lettre, et ce qu'ils tournent ; V.4.2 (l'ecran ne se touche plus) : leur
      // clic ouvre ce qu'ouvrait le bloc (la page d'un FX, la liste des sons), presets ouverts ce qui est ecrit au-dessus
      ...Object.fromEntries(PAGE_KNOB_LETTERS.map((l, k) => [`penc-${k}`, `Knob ${l}: the function in the same place on the screen; click: what it opens there`])),
    };

/**
 * La serigraphie de la face DT2 (V.6.0, ?face=dt2, cahier 2.3) : les lettres A a H a 6 h dans la fente de l'anneau, MAIN
 * VOLUME et LEVEL/DATA sous leur potard et PRESET POOL en orange, la fonction orange sous chaque touche (gap sous la
 * touche, le meme corps pour toutes), KB OCT a droite de UP, TRACK/MUTE entre les deux rangees de TRIG. Le wordmark,
 * MM-RYTM et le firmware passent sur le decalque du cadre de l'ecran (scene/silk.ts BezelDecal) ; plus de ligne d'aide.
 */
const DT2_SILK_TEXTS = (): SilkText[] => {
  const A = DT2.buttons.alt;
  const S = DT2.side;
  const out: SilkText[] = FACE_KNOBS.map((k, i) => ({ text: FP_KNOBS.labels[i] ?? PAGE_KNOB_LETTERS[i], x: k.x, z: k.labelZ, cap: PAGE_KNOBS.cap, maxW: PAGE_KNOBS.labelW, group: 'genc', weight: 700, alpha: 0.9 }));
  for (const s of S.knobs) {
    const cy = s.cy + s.d / 2 + S.legend.gap + S.legend.cap / 2;
    out.push({ text: s.legend, x: fpX(s.cx), z: fpZ(cy), cap: fpU(S.legend.cap), maxW: fpU(21), group: 'side', weight: 700, alpha: 0.9 });
    if (s.alt) out.push({ text: s.alt, x: fpX(s.cx), z: fpZ(cy + S.legend.cap / 2 + S.alt.gap + S.alt.cap / 2), cap: fpU(S.alt.cap), maxW: fpU(21), group: 'alt', weight: 700, ink: 'alt', alpha: 1 });
  }
  for (const b of DT2.buttons.keys) {
    if (!b.alt) continue;
    const c = rectCenter(b.rect);
    out.push({ text: b.alt, x: c.x, z: fpZ(b.rect.y + b.rect.h + A.gap + A.cap / 2), cap: fpU(A.cap), maxW: fpU(A.w), group: 'alt', weight: 700, ink: 'alt', alpha: 1 });
  }
  const K = DT2.silk.kbOct;
  out.push({ text: K.text, x: fpX(K.x), z: fpZ(K.cy), cap: fpU(K.cap), maxW: fpU(K.w), align: 'left', group: 'alt', weight: 700, ink: 'alt', alpha: 1 });
  const T = DT2.silk.trackMute;
  out.push({ text: T.text, x: fpX(T.cx), z: fpZ(T.cy), cap: fpU(T.cap), group: 'alt', weight: 700, ink: 'alt', alpha: 1 });
  return out;
};

export const SILK_TEXTS: readonly SilkText[] = DT2_FACE ? DT2_SILK_TEXTS() : [
  // Le repli du wordmark : au desktop V.4.0 (2026-10-27) dans sa largeur
  { text: 'MAUDITE MACHINE', x: HEAD.word.x, z: HEAD.word.z, cap: 0.2, align: 'left', weight: SILK.strongWeight, fallbackFor: 'wordmark', ...(PORTRAIT ? {} : { maxW: HEAD.word.w }) },
  { text: 'MM-RYTM', x: HEAD.model.x, z: HEAD.model.z, cap: HEAD.model.cap, align: HEAD.model.align },
  { text: fwText('mm808'), x: HEAD.firmware.x, z: HEAD.firmware.z, cap: HEAD.firmware.cap, align: 'right', alpha: 0.45 },
  // VOICES au-dessus des pads (2026-10-09, sur la ligne des noms de MASTER et TEMPO ; ils sont dans l'ecran depuis le
  // 2026-10-19, VOICES garde sa place au desktop, juste au-dessus des pads au telephone) ; plus de pads au desktop
  // depuis la face V.4.0 (2026-10-27), plus de VOICES
  ...(PORTRAIT || PAD_FACE ? [{ text: 'VOICES', x: PAD.x0 - PAD.size / 2, z: PAD.rowZ[0] - PAD.size / 2 - 0.14, cap: 0.075, align: 'left' as const }] : []),
  ...FACE_KNOBS.map((k, i) => ({
    text: PORTRAIT || PAD_FACE ? GLOBAL_ENC_LABELS[i] : (RYTM_FACEPLATE.knobs.labels[i] ?? PAGE_KNOB_LETTERS[i]),
    x: k.x,
    z: k.labelZ,
    cap: PAGE_KNOBS.cap,
    maxW: PAGE_KNOBS.labelW,
    group: 'genc',
    weight: 700,
    alpha: 0.9,
  })),
  ...(PORTRAIT || PAD_FACE ? [{ text: 'GLOBAL FX', x: OLED.x, z: GLOBAL_FX_RULE.z, cap: 0.075, weight: 700, alpha: 0.7 }] : []),
  ...PADS.map(padLabel),
  ...(PORTRAIT || PAD_FACE ? Array.from({ length: KEYS.count }, (_, i) => ({ text: String(i + 1), x: keyX(i), z: KEYS.numberZ + keyDz(i), cap: 0.095, weight: 600 })) : []),
  ...(PORTRAIT || PAD_FACE
    ? []
    : [{ text: '\u25CF REC: WRITE STEPS \u00B7 WITHOUT REC: STEPS 1-8 PLAY THE VOICES \u00B7 HOLD A STEP + KNOB: P-LOCK \u00B7 FUNC + STEP 1-8: MUTE (REC: LOCK TRIG)', x: (keyX(0) + keyX(KEYS.count - 1)) / 2, z: KEYS.bracketZ + 0.25, cap: 0.068, weight: 700, alpha: 0.8, maxW: fpU(RYTM_FACEPLATE.size.w - 16) }]),
  ...(PORTRAIT || PAD_FACE || RYTM_FACE_VER === '4.0'
    ? []
    : RYTM_FACEPLATE.buttons.keys.flatMap((b, i) => {
        const A = RYTM_FACEPLATE.buttons.alt;
        return b.alt ? [{ text: b.alt, x: faceKeyX(i), z: fpZ(A.cy), cap: fpU(A.cap), maxW: fpU(A.w), group: 'alt', weight: 700, ink: 'alt' as const, alpha: 1 }] : [];
      })),
];

/**
 * RUN : nom fixe, l'etat de lecture passe par aria-pressed (revue). La face V.4.0 du desktop (2026-10-27) : plus de pads,
 * plus de nom ecrit sur les touches ; RUN dit son nom complet (Run / Stop), MUTE ne parle plus d'un pad (une voix se coupe
 * au MIDI, rytm:voice:<voix>:mute, ou TRK et deux tapes sur son pas depuis la phase 2), SOLO et SOUND nomment les touches A S D F et Z X C V. Le
 * telephone garde ses mots.
 */
export const TWIN_ARIA = {
  run: PORTRAIT ? 'Run, Space' : 'Play, pause and resume (PLAY), Space; FUNC + PLAY: clear',
  clear: 'Clear pattern',
  // 2026-10-21 (audit) : MUTE n'arme plus de mode depuis le 2026-10-10 (actions.ts muteToggle) ; une voix se coupe a son pad.
  // La face V.4.0 du desktop (2026-10-27, sans pads) : MUTE arme de nouveau le mode, la voix vient au clavier
  mute: PORTRAIT
    ? 'Mute: right-click a voice pad (double-tap it on a touch screen, or press the context menu key on it) to mute or unmute it; press MUTE to bring all voices back'
    : 'Mute, then press a voice key (A S D F, Z X C V) or hold TRK and press its step (1 to 8) to mute or unmute it; press twice to mute several voices; with voices muted, press to bring them all back; without arming MUTE, hold or tap TRK, then double-tap a step to mute its voice',
  solo: PORTRAIT
    ? 'Solo, then tap a voice to solo it; press twice to solo several voices; press again to bring them all back'
    : 'Solo, then press a voice key (A S D F, Z X C V) to solo it; press twice to solo several voices; press again to bring them all back',
  random: 'Random house pattern',
  // V.5.0 (2026-10-29, la face facon Digitakt) : les jumeaux des nouvelles touches et de celles qui changent (le desktop)
  func: 'Function (FUNC): press, then a key for its orange function (FUNC + PLAY: clear, FUNC + REC: copy, FUNC + STOP: paste, FUNC + YES: save, FUNC + NO: reload); press twice to keep it; Alt key',
  rec: 'Record (REC): steps write only while it is lit; FUNC + REC: copy',
  play: 'Play, pause and resume (PLAY), Space; FUNC + PLAY: clear',
  stop: 'Stop (STOP), back to step 1; twice: cuts the reverb and delay tails; Shift + Space; FUNC + STOP: paste',
  yes: 'Yes (YES), Enter: confirm; after a page key, randomize that page (TRIG then YES: a random beat); on TEMPO: tap tempo; FUNC + YES: save point',
  no: 'No (NO), Escape: back; after a page key, reload that page from the save point; FUNC + NO: reload everything',
  ptn: 'Pattern (PTN), key E: the 16 patterns on the steps; press twice: KIT, the presets; FUNC + PTN: banks',
  trig: 'Trig page (TRIG): note, velocity, length, probability, condition, micro timing; press again for retrig; then YES: a random beat; FUNC + TRIG: tempo',
  mod: 'Modulation page (MOD): two LFOs per voice, press again for LFO 2; FUNC + MOD: mixer',
  group: 'MM-RYTM drum machine',
  soundNoVoice: PORTRAIT ? 'Sound: tap a pad first' : 'Sound: pick a voice first, keys A S D F and Z X C V',
  // Le crossfader (2026-10-27, P2-20) : son jumeau, un curseur natif
  xfade: 'Crossfader, scene A to scene B',
} as const;
