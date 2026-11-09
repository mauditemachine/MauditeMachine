/**
 * Le theme, la couche du dessous de la face (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) : ce que theme/face.ts
 * lit a son evaluation (PORTRAIT, les pads, l'ecran, les potards de page, l'en-tete de la serigraphie...), deplace tel quel
 * de theme.ts. Il ne lit ni theme.ts ni theme/face.ts (sinon un cycle a l'evaluation : une const lue en zone morte).
 * theme.ts re-exporte ses exports.
 */

import { DT2_FACEPLATE, RYTM_FACEPLATE, buttonRect, fpU, fpX, fpZ, rectCenter, type FpMark } from '../rytm/faceplate';
import type { Dt2ButtonId } from '../rytm/dtFaceIds';

/* ---------- disposition portrait (essai mobile, 2026-10-01) ---------- */

/**
 * Disposition portrait (2026-10-01, demande de Mika) : sur telephone, la
 * machine en hauteur plutot qu'en largeur, facon Traktor X1 ou SP-404 : les
 * memes elements, places autrement (8.2 x 14.4 au sol, l'ecran et MASTER /
 * TEMPO en haut, le transport, la rangee GLOBAL, les pads, la rangee
 * VOICE, puis les 16 pas en deux rangees de 8), boutons deux fois plus
 * grands a l'ecran. Par defaut sous 768 px de large, au chargement ;
 * ?portrait=1 ou ?portrait=0 la forcent dans un sens ou dans l'autre (a
 * toute largeur, retenu pour l'onglet). Toutes les cotes en decoulent ; le
 * desktop ne change pas. Changer de largeur ensuite ne la change pas :
 * recharger.
 */
/**
 * Le genre de plugin demande (2026-11-09, plugin/mm-arp) : window.__MM_PLUGIN__ = true (la page du MM-RYTM, plugin/mm-rytm)
 * ou 'arp' (la page du MM-ARP, plugin/mm-arp), sinon ?plugin=1 (RYTM) ou ?plugin=arp (ARP) dans l'adresse (essai dans un
 * navigateur). Lu une fois, a l'evaluation, avant PORTRAIT ; jamais retenu.
 */
export type PluginKind = 'rytm' | 'arp';
const pluginFlag = (): PluginKind | 'rytm-url' | null => {
  if (typeof window === 'undefined') return null;
  try {
    const f = (window as unknown as { __MM_PLUGIN__?: unknown }).__MM_PLUGIN__;
    if (f === true) return 'rytm';
    if (f === 'arp') return 'arp';
    const q = new URLSearchParams(window.location.search).get('plugin');
    if (q === 'arp') return 'arp';
    return q === '1' ? 'rytm-url' : null;
  } catch {
    return null;
  }
};
const PLUGIN_FLAG = pluginFlag();

export const PORTRAIT: boolean = (() => {
  if (typeof window === 'undefined') return false;
  // Le plugin (plus bas) : toujours la face du desktop, quelle que soit la largeur de sa fenetre
  if (PLUGIN_FLAG === 'rytm' || PLUGIN_FLAG === 'arp') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('portrait');
    if (q === '1' || q === '0') window.sessionStorage.setItem('mm.v4.portrait', q);
    const forced = window.sessionStorage.getItem('mm.v4.portrait');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  } catch {
    return false;
  }
})();

/**
 * Le plugin (2026-11-08, Mika : "lance la WebView avec ma vraie face", plugin/mm-rytm) : la face du MM-RYTM seule, dans
 * la fenetre du VST3 (WebView JUCE), vue de dessus, sans le reste du site ; le son vient du plugin (C++), jamais du
 * navigateur. Pose par la page du plugin (window.__MM_PLUGIN__, avant tout module) ou ?plugin=1 (essai dans un
 * navigateur). Lu a l'evaluation des modules, comme PORTRAIT ; jamais retenu.
 */
export const PLUGIN: boolean = PLUGIN_FLAG !== null;

/**
 * Quelle machine le plugin montre (2026-11-09) : 'rytm' (plugin/mm-rytm, window.__MM_PLUGIN__ = true, ?plugin=1), 'arp'
 * (plugin/mm-arp, window.__MM_PLUGIN__ = 'arp', ?plugin=arp : le MM-ARP seul, vu de dessus), null hors du plugin (le site).
 * PLUGIN est vrai pour les deux.
 */
export const PLUGIN_KIND: PluginKind | null = PLUGIN_FLAG === null ? null : PLUGIN_FLAG === 'arp' ? 'arp' : 'rytm';
/** Le plugin MM-ARP (raccourci de PLUGIN_KIND === 'arp'). */
export const PLUGIN_ARP: boolean = PLUGIN_KIND === 'arp';

/**
 * La face Digitakt II de la V.6.0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 2 et 5.1, la lane B3) : depuis l'integration
 * de la V.6.0 (2026-11-01, les lanes B3 a B6 branchees), la face par defaut du desktop. ?face=v5 dans l'URL rend la face
 * V.5.3 (pour comparer et revenir en arriere : la face, le clavier, le MIDI et l'ecran d'avant) ; ?face=dt2 (les liens et
 * les sondes d'avant) reste la DT2. Le telephone garde toujours sa face (cahier 1.3) : faux au telephone, et hors d'un
 * navigateur (les tests de node). Lu au chargement, jamais retenu (un rechargement sans ?face=v5 rend la DT2). Tout ce qui
 * en depend se decide a l'evaluation des modules, comme PORTRAIT.
 */
export type RytmFaceVer = '1.0' | '2.0' | '3.0' | '4.0' | '5.0' | '6.0';
export const RYTM_VERSIONS: readonly RytmFaceVer[] = ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0'];

/**
 * Le selecteur de version du MM-RYTM (2026-11-02, Mika : "un selecteur de machine parmis les dernieres versions quand on
 * clic sur open la machine.. version 1.0 2.0 etc.. pour pouvoir voir les evolutions et a chaque fois le site se rafraichi") :
 * ?face=v1 a ?face=v6 dans l'URL (sans ?face= ou ?face=dt2 : 6.0). Au telephone et sous node (tests), 5.0.
 */
export const RYTM_FACE_VER: RytmFaceVer = (() => {
  if (PORTRAIT || typeof window === 'undefined') return '5.0';
  // Le plugin : toujours la machine complete (la face DT2), quelle que soit l'adresse
  if (PLUGIN) return '6.0';
  try {
    const f = new URLSearchParams(window.location.search).get('face');
    // 2026-11-08 (Mika : "sur internet met la version avant le crossfad qui etait trop complexe") : sur le site, la V.3.0 par
    // defaut (8 pads de voix, EDIT et OPEN, GLOBAL FX, 16 pas : d'avant les scenes et le crossfader de la V.4.1 et la face
    // facon Digitakt) ; les autres restent au selecteur de versions (?face=v4, v5, v6 ou dt2)
    if (f === null || f === '') return '3.0';
    if (f === 'v6' || f === '6' || f === '6.0' || f === 'dt2') return '6.0';
    if (f === 'v1' || f === '1' || f === '1.0') return '1.0';
    if (f === 'v2' || f === '2' || f === '2.0') return '2.0';
    if (f === 'v3' || f === '3' || f === '3.0') return '3.0';
    if (f === 'v4' || f === '4' || f === '4.0') return '4.0';
    if (f === 'v5' || f === '5' || f === '5.0') return '5.0';
    return '3.0';
  } catch {
    return '3.0';
  }
})();

export const DT2_FACE: boolean = !PORTRAIT && typeof window !== 'undefined' && RYTM_FACE_VER === '6.0';
/** Les versions a 10 pads du desktop (V.1.0, V.2.0, V.3.0) : ecran a gauche, pads a droite, 16 pas en une rangee. */
export const PAD_FACE: boolean = !PORTRAIT && typeof window !== 'undefined' && (RYTM_FACE_VER === '1.0' || RYTM_FACE_VER === '2.0' || RYTM_FACE_VER === '3.0');

/** Les potards A a H de la face lue (la V.5.3 ou la DT2 : la meme forme, rytm/faceplate.ts knobs). */
export const FP_KNOBS = DT2_FACE ? DT2_FACEPLATE.knobs : RYTM_FACEPLATE.knobs;
/** La zone du logo M (OPEN) de la face lue. */
export const FP_OPEN = DT2_FACE ? DT2_FACEPLATE.open : RYTM_FACEPLATE.open;

/**
 * Serigraphie du panneau (spec 20.3.9), facon legendes Elektron : SF Pro
 * Display 500, capitales fines et espacees (0.2 em), bone 85 % ; le nom de
 * la machine en 600. Filets de 0.012, bone 35 %.
 */
export const SILK = {
  weight: 500,
  strongWeight: 600,
  tracking: 0.2,
  alpha: 0.85,
  /** hauteur de capitale de SF Pro Display, en em */
  capRatio: 0.7,
  lineWidth: 0.012,
  lineAlpha: 0.35,
  /** lueur des noms orange (emissif = leur couleur x orangeGlow) : lisibles sous la lumiere */
  orangeGlow: 0.6,
} as const;

/* ---------- panneau : moitie gauche (spec 20.3.4) ---------- */

/**
 * Ecran OLED en haut a gauche : verre a cadre fusionne au panneau.
 * Plus grand depuis le 2026-10-08 (Mika : "je veux donc des ecrans super
 * evolues ; plus gros, plus de detail ; fais de la place ; que ce soit super
 * responsive en mobile") : 5.0 x 1.875 au desktop (3.6 x 1.35 avant), 6.9 x
 * 2.5875 au telephone (3.6 x 1.35 avant, illisible a 140 px de large) :
 * MASTER et TEMPO sont descendus a cote des potards de page (FACE_KNOBS), sa
 * colonne a droite de l'ecran est a lui. Les proportions de la texture (640
 * x 240) ne changent pas. Ses quatre colonnes de blocs (vue PAGE,
 * scene/screen.ts) tombent au-dessus des huit potards de page (pageKnobX).
 *
 * Au telephone, plus grand encore depuis le 2026-10-09 (Mika : "en mobile
 * c'est mieux si tu ne mets pas d'encoders ; on change dans l'ecran
 * directement ; forcement donne-moi un ecran plus grand") : les potards de
 * page ont quitte la face, l'ecran prend leur place, toute la largeur du
 * panneau (le cadre aligne sur le logo et le logotype, 7.5) et plus haut :
 * 7.28 x 3.59, une texture de 640 x 316 (OLED_UH = 158 unites de haut au
 * lieu de 120, deux pixels l'unite comme au desktop ; 154 avant la revue du
 * 2026-10-09, le pied y tenait mal), son haut a -6.3 (sous l'en-tete), sa
 * place en bas comptee au plus juste avec celles des touches de page et de
 * MASTER / TEMPO (PAGE_KEYS ; MASTER et TEMPO y sont dessines depuis le
 * 2026-10-19, les encodeurs GLOBAL FX ont repris leur place). La vue
 * PAGE s'y etale (scene/screen.ts, la mise en page haute) ; HOME, EDIT et
 * les presets gardent leur dessin de 120, centre (OLED_DY).
 *
 * Au desktop, plus grand aussi depuis le 2026-10-18 (Mika : "RYTM je
 * voudrais un ecran plus grand") : le dessin haut du telephone (OLED_UH 158,
 * la mise en page TALL de scene/screen.ts) sur un verre de 5.3 x 2.617
 * (5.0 x 1.875 avant), une texture de 640 x 316. Son bord gauche reste sur
 * la ligne du logo (-5.75), son haut sous l'en-tete (-2.8175, comme avant) ;
 * 5.3 et pas 5.4 : a 5.4 le cadre arrivait a 0.1 du bord des pads BD et CP
 * (leur halo le mordait), a 5.3 il en reste 0.2. Dessous, tout est remonte
 * en consequence (PAGE_KEYS, PAGE_KNOBS en une rangee, GLOBAL_FX_RULE).
 */
/*
 * La face V.4.0 du desktop (2026-10-27, Mika : "ecran 4.3 pouces 800 x 480 : x 8, y 8, 106 x 67 ; le contenu ne change
 * pas : 8 blocs de 0 a 127, 4 pages, l'ecran d'aujourd'hui remis en page pour cette taille") : le verre (bezel) est
 * l'ecran de 106 x 67 en 8, 8 (rytm/faceplate.ts screen.rect), noir ; le plan texture (w, d) est la zone active 5:3 de
 * la dalle 800 x 480, 93.6 x 56.16, centree dans le verre. Le dessin passe a 320 x 192 unites (OLED_UH, 5:3), la toile a
 * 1600 x 960 (scene/screen.ts) ; tex reste l'espace de reference, deux px par unite (640 x 384).
 */
/** La hauteur du dessin de l'ecran, en unites (sa largeur : 320) ; 158 partout depuis le 2026-10-18 (120 au desktop avant) ; 192 au desktop depuis le 2026-10-27 (5:3). */
export const OLED_UH = PORTRAIT || RYTM_FACE_VER === '2.0' || RYTM_FACE_VER === '3.0' ? 158 : RYTM_FACE_VER === '1.0' ? 120 : 192;
// La face DT2 (V.6.0, ?face=dt2) : le meme ecran, deplace (x 34 a 140) ; le dessin ne change pas (5:3)
const FP_SCREEN = DT2_FACE ? DT2_FACEPLATE.screen : RYTM_FACEPLATE.screen;
export const OLED = PORTRAIT
  ? ({ x: 0, z: -6.3 + (7.28 * OLED_UH) / 640, w: 7.28, d: (7.28 * OLED_UH) / 320, y: 0.025, tex: [640, OLED_UH * 2], bezel: { w: 7.5, d: (7.28 * OLED_UH) / 320 + 0.22, h: 0.02 } } as const)
  : PAD_FACE && RYTM_FACE_VER === '1.0'
    ? ({ x: -3.25, z: -2.8175 + 1.875 / 2, w: 5.0, d: 1.875, y: 0.025, tex: [640, OLED_UH * 2], bezel: { w: 5.2, d: 2.095, h: 0.02 } } as const)
    : PAD_FACE
      ? ({ x: -3.1, z: -2.8175 + ((5.3 * OLED_UH) / 320) / 2, w: 5.3, d: (5.3 * OLED_UH) / 320, y: 0.025, tex: [640, OLED_UH * 2], bezel: { w: 5.5, d: (5.3 * OLED_UH) / 320 + 0.22, h: 0.02 } } as const)
      : ({
          x: fpX(FP_SCREEN.rect.x + FP_SCREEN.rect.w / 2),
          z: fpZ(FP_SCREEN.rect.y + FP_SCREEN.rect.h / 2),
          w: fpU(FP_SCREEN.active.w),
          d: fpU(FP_SCREEN.active.h),
          y: 0.025,
          tex: [640, OLED_UH * 2],
          bezel: { w: fpU(FP_SCREEN.rect.w), d: fpU(FP_SCREEN.rect.h), h: 0.02 },
        } as const);
/** SCENE A et B (2026-10-27) : 12 x 12 en V.5.0, 10 x 11 en V.6.0 (DT2_FACE). */
const FP_SCENES = DT2_FACE ? DT2_FACEPLATE.scenes : RYTM_FACEPLATE.scenes;
export const SCENE_KEY = { w: fpU(FP_SCENES.a.rect.w), d: fpU(FP_SCENES.a.rect.h) } as const;
export const faceKeyX = (i: number): number => rectCenter(buttonRect(i)).x;
/**
 * Les touches de la face du desktop (scene/rytmFaceKeys.ts) : depuis V.5.0 (2026-10-29) les quatorze de la rangee (leurs
 * ids, rytm/faceplate.ts FpButtonId), SCENE A et SCENE B ; la face DT2 (V.6.0, ?face=dt2) : ses 25 touches
 * (rytm/dtFaceIds.ts Dt2ButtonId, qui contient les quatorze), sans les scenes.
 */
export type FaceKeyId = Dt2ButtonId | 'scene-a' | 'scene-b';

/* ---------- panneau : moitie droite, les 12 pads (spec 20.3.5) ---------- */

/**
 * Les dix voix (2026-10-03, Mika : "occupe l'espace pour d'autres voix
 * parametrables, prends exemple sur une Rytm") : la rangee d'origine BD SD
 * TOM CH OH, et sous elle CP (clap) RS (rimshot) HT (tom aigu) CY
 * (cymbale), les noms de l'Analog Rytm, et PC (percussion facon conga, les
 * PC de Mika ; elle remplace la cloche CB le jour meme, Mika n'aimait pas
 * son son).
 */
export type Inst = 'BD' | 'SD' | 'TOM' | 'CH' | 'OH' | 'CP' | 'HT' | 'CY';
/** Les cinq pages du site (touches 1 a 5 ; puces de la carte des deux machines). */
export type PageId = 'tracks' | 'mixtapes' | 'press' | 'shows' | 'contact';

/**
 * Pad en caoutchouc : 0.86 x 0.22 x 0.86 a coins arrondis (0.08), dome de
 * 0.04 sur son dessus plat ; deux rangees de six, pas de 1.0 (2026-10-01 :
 * 12 pads, LABEL et SONAA sont partis dans CONTACT ; la rangee finit a
 * l'aplomb de la derniere touche trig).
 * Frappe : il s'enfonce de 0.06 en 60 ms, remonte en 180 ms. Halo : un
 * carre de 1.0 a plat sous chaque pad (retroeclairage).
 */
export const PAD = {
  size: 0.98,
  height: 0.22,
  radius: 0.08,
  segments: { desktop: 3, mobile: 2 },
  dome: 0.04,
  domeSegments: 6,
  /** hauteur du plan du dome, un soupcon au-dessus du dessus plat (pas de z-fight) */
  domeY: 0.222,
  x0: PORTRAIT ? -2.8 : 0.37,
  // Huit voix (2026-10-05) : quatre colonnes et EDIT/OPEN sur la largeur des six d'avant, des pads un peu plus grands
  pitch: PORTRAIT ? 1.4 : 1.25,
  // Portrait : plus bas le 2026-10-08 (l'ecran plus grand, les potards et les touches de page au-dessus),
  // encore un peu (revue de R1 : les noms des touches de page touchaient les pads, 39 px entre leurs centres) ;
  // desktop : 0.25 plus bas le 2026-10-09 (Mika : "Master et Tempo des knobs differents au dessus des voices"),
  // la bande sous l'en-tete leur revient (dans l'ecran depuis le 2026-10-19, les pads restent) ;
  // portrait : 1.02 plus bas le 2026-10-19, les deux rangees d'encodeurs GLOBAL FX au-dessus (FACE_KNOBS)
  rowZ: PORTRAIT ? [1.22, 2.48] : [-1.8, -0.5],
  /** serigraphie sous chaque pad (portrait : un rien plus pres, la rangee du bas garde son jour sur le transport) */
  labelDz: PORTRAIT ? 0.6 : 0.64,
  press: 0.06,
  halo: PORTRAIT ? 1.4 : 1.25,
  haloY: 0.003,
} as const;

export interface VoicePad {
  id: Inst;
  kind: 'voice';
  label: string;
  key: string;
  x: number;
  z: number;
}
export interface PagePad {
  id: PageId;
  kind: 'page';
  label: string;
  key: string;
  x: number;
  z: number;
}
export interface OpenPad {
  id: 'open';
  kind: 'open';
  label: string;
  key: string;
  x: number;
  z: number;
}
/** EDIT (2026-10-04) : ouvre l'editeur du motif et de ses velocites (ui/BeatEditor.tsx). */
export interface EditPad {
  id: 'edit';
  kind: 'edit';
  label: string;
  key: string;
  x: number;
  z: number;
}
export type PadSpec = VoicePad | PagePad | OpenPad | EditPad;

/** Les colonnes des voix (2026-10-05 : quatre, huit voix) ; EDIT et OPEN dans la suivante. */
export const VOICE_COLS = 4;

/** Un pad de la grille : colonne 0 a 4 (4 : EDIT et OPEN), rangee 0 ou 1. */
const padAt = (col: number, row: 0 | 1): { x: number; z: number } => ({ x: PAD.x0 + PAD.pitch * col, z: PAD.rowZ[row] });

/**
 * Les 11 pads (2026-10-03) : dix voix sur deux rangees, BD SD TOM CH OH en
 * haut (touches A S D F G), CP RS HT CY PC dessous (Z X C V B), chacune
 * sous sa voisine (BD et CP, SD et RS, TOM et HT, CH et CY, OH et PC) ;
 * la sixieme colonne : EDIT en haut (2026-10-04, l'editeur du motif), OPEN
 * dessous (seul, a mi-hauteur, jusque-la). Les pages (TRACKS a
 * CONTACT) sont parties sur la carte (PAGE_CHIPS, Mika : "mets-les dans
 * OPEN") ; elles gardent les touches 1 a 5. OPEN : 6 (et O).
 */
/**
 * Les touches du clavier des huit voix, de OPEN et d'EDIT (2026-10-27) : elles ne dependent plus des pads (la face V.4.0
 * du desktop n'en a plus) ; A S D F / Z X C V choisissent toujours BD SD CH OH / CP TOM HT CY (hooks/useKeys.ts).
 */
export const VOICE_KEYS: Readonly<Record<Inst, string>> = { BD: 'A', SD: 'S', CH: 'D', OH: 'F', CP: 'Z', TOM: 'X', HT: 'C', CY: 'V' };
export const OPEN_KEY = '6';
export const EDIT_KEY = 'E';

/*
 * La face V.4.0 du desktop (2026-10-27, Mika : "les 10 grands pads disparaissent ; EDIT et OPEN sont dans la rangee des
 * pictogrammes") : plus de pads au desktop (EDIT et OPEN : scene/rytmFaceKeys.ts) ; le telephone garde les siens.
 */
export const PADS: readonly PadSpec[] = !PORTRAIT && !PAD_FACE ? [] : [
  // Huit voix (2026-10-05, Mika : "je veux finalement 8 VOICES dans RYTM, enleve RS et PC") :
  // le groove en haut (kick, caisse claire, les deux charleys), le reste dessous (clap, les deux toms, la cymbale)
  { id: 'BD', kind: 'voice', label: 'BD', key: VOICE_KEYS.BD, ...padAt(0, 0) },
  { id: 'SD', kind: 'voice', label: 'SD', key: VOICE_KEYS.SD, ...padAt(1, 0) },
  { id: 'CH', kind: 'voice', label: 'CH', key: VOICE_KEYS.CH, ...padAt(2, 0) },
  { id: 'OH', kind: 'voice', label: 'OH', key: VOICE_KEYS.OH, ...padAt(3, 0) },
  { id: 'CP', kind: 'voice', label: 'CP', key: VOICE_KEYS.CP, ...padAt(0, 1) },
  { id: 'TOM', kind: 'voice', label: 'TOM', key: VOICE_KEYS.TOM, ...padAt(1, 1) },
  { id: 'HT', kind: 'voice', label: 'HT', key: VOICE_KEYS.HT, ...padAt(2, 1) },
  { id: 'CY', kind: 'voice', label: 'CY', key: VOICE_KEYS.CY, ...padAt(3, 1) },
  // La colonne d'apres (2026-10-04) : EDIT en haut (l'editeur du motif), OPEN dessous
  { id: 'edit', kind: 'edit', label: 'EDIT', key: EDIT_KEY, ...padAt(VOICE_COLS, 0) },
  { id: 'open', kind: 'open', label: 'OPEN', key: OPEN_KEY, ...padAt(VOICE_COLS, 1) },
];

/* ---------- panneau : les 16 touches trig (spec 20.3.6) ---------- */

/**
 * Touches trig etroites (0.5 x 0.9, 0.1 de haut, coins de 0.04) en bas du
 * panneau, numeros 1 a 16 dessous, un crochet serigraphie sous chaque groupe
 * de quatre. Coins et aretes vraiment arrondis depuis le 2026-10-01 (trois
 * segments, deux sur mobile) : avec un seul, c'etaient des pans coupes a 45 deg.
 * Plus de LED au-dessus depuis le 2026-10-19 (Mika : "je veux que les boutons
 * soient allumes au complet sur le step quand la velocite est a 127 ; les trois
 * barres au-dessus, ca casse le design") : la touche elle-meme s'allume, plus
 * ou moins selon la velocite (STEP_LIT).
 */
/*
 * La face V.4.0 du desktop (2026-10-27, Mika : "16 pas en 2 rangees de 8 sur toute la largeur : 27.6 x 20, pas
 * horizontal de 30.4, depuis x 8, rangees en y 104 et 128") : rytm/faceplate.ts steps ; le cadre des temps et la marque
 * des verrous a l'echelle des touches ; numberZ et bracketZ ne servent plus au desktop (le numero est sur la touche,
 * KEY_LABELS ; plus de crochets), gardes pour le type.
 */
// La face DT2 (V.6.0, ?face=dt2) : 22 x 19 au pas de 190 / 7 depuis x 36, en y 111 et 133, le numero seul
export const FP_STEPS = DT2_FACE ? DT2_FACEPLATE.steps : RYTM_FACEPLATE.steps;

/**
 * Les potards de la face (2026-10-08, la refonte facon Digitakt, Mika :
 * "il faudrait vraiment faire comme un principe de machine Elektron ; les
 * valeurs des knobs sont a l'ecran, pas sur les encodeurs ; RYTM : je ne
 * vois AUCUN changement de ce que j'ai demande") : les rangees GLOBAL FX et
 * VOICE FX ont quitte la face (leurs reglages sont sur les pages, la page FX
 * les empile colonne par colonne). Depuis le 2026-10-09 : sous l'ecran, les
 * touches de page sur toute sa largeur (PAGE_KEYS), puis les huit encodeurs
 * A a H, les FX globaux a poste fixe (GLOBAL_ENCODERS).
 * MASTER et TEMPO ont ete deux potards d'aluminium au-dessus des voix du
 * 2026-10-09 au 2026-10-19 ; depuis (Mika : "mets ces boutons dans l'ecran en
 * mobile et en desktop, je voudrais qu'ils soient mieux faits"), ils sont
 * dessines dans l'ecran (scene/screen.ts, les zones lcd-master et lcd-tempo).
 * Au telephone, les huit encodeurs avaient quitte la face le 2026-10-09 (Mika :
 * "en mobile c'est mieux si tu ne mets pas d'encoders ; on change dans l'ecran
 * directement") ; ils reviennent le 2026-10-19, la place de MASTER, TEMPO et
 * des LED des pas liberee (Mika : "nous allons avoir plus d'espace de ce fait,
 * donc remets les knobs des FX globaux") : deux rangees de quatre sous les
 * touches de page, une colonne sous chaque touche ; les blocs de l'ecran restent
 * les commandes de la page affichee.
 */
export type PageKnobId = 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7';
/** Les potards de la face : les huit encodeurs (MASTER et TEMPO sont dans l'ecran depuis le 2026-10-19). */
export type FaceKnobId = PageKnobId;
export const PAGE_KNOB_IDS: readonly PageKnobId[] = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
/** Les lettres des potards de page (serigraphie, ecran, jumeaux, MIDI). */
export const PAGE_KNOB_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export interface EncPlace {
  x: number;
  z: number;
  labelZ: number;
  /** echelle du potard */
  s: number;
}

/**
 * Le centre des touches de page du desktop (2026-10-18) : 0.09 sous le cadre du verre plus haut, la moitie de leur
 * profondeur. Plus lu au desktop depuis la face V.4.0 (2026-10-27 : les touches et les potards ont leur place en mm, il
 * n'y a plus de filet GLOBAL FX) ; GLOBAL_FX_RULE ne sert plus qu'au telephone.
 */
const DESK_PKEY_Z = OLED.z + OLED.bezel.d / 2 + 0.09 + 0.19;
/** Le centre et la largeur des touches de page du telephone (PAGE_KEYS) : les colonnes des encodeurs s'y alignent (2026-10-19). */
export const PAGE_KEYS_PHONE_Z = -2.275;
export const PAGE_KEYS_PHONE_W = 1.62;

/**
 * Le filet entre les touches de page et les encodeurs (revue du 2026-10-09) :
 * sa profondeur, et l'ouverture en son milieu ou se lit GLOBAL FX (le titre des
 * huit encodeurs, sur le filet : sous VOICE il se lisait VOICE GLOBAL FX). Les
 * noms des encodeurs 0.46 au-dessus de leur centre (0.37 : la collerette, vue
 * d'en haut, mangeait le bas de DIST et de REVERB). Depuis le 2026-10-18 les
 * noms des touches sont sur elles : le filet passe dz sous le bord avant des
 * touches (z, son z sur le panneau). Au telephone (2026-10-19), sous les
 * touches de page aussi, a 0.255 de leur bord avant.
 */
export const GLOBAL_FX_RULE = PORTRAIT
  ? ({ dz: 0.255, gap: 0.5, z: PAGE_KEYS_PHONE_Z + 0.22 + 0.255 } as const)
  : ({ dz: 0.16, gap: 0.36, z: DESK_PKEY_Z + 0.19 + 0.16 } as const);

/**
 * x de l'encodeur k (0 a 7). Desktop : une rangee de huit centree sous le verre
 * au pas PAGE_KNOBS.pitch (2026-10-18). Telephone (2026-10-19) : la colonne
 * k % 4, sous la touche de page du meme rang (pageKeyX).
 */
export const pageKnobX = (k: number): number => {
  if (PAD_FACE && RYTM_FACE_VER === '1.0') {
    const x0 = OLED.x - OLED.w / 2 + 0.575;
    const x1 = OLED.x + OLED.w / 2 - 0.575;
    return x0 + ((x1 - x0) * (k % 4)) / 3;
  }
  if (PAD_FACE) return OLED.x + (k - 3.5) * 0.66;
  // La face V.4.0 du desktop (2026-10-27) : la colonne k % 4 de la grille de Mika
  if (!PORTRAIT) return fpX(FP_KNOBS.cx[k % 4]);
  const x0 = OLED.x - OLED.w / 2 + PAGE_KEYS_PHONE_W / 2;
  const x1 = OLED.x + OLED.w / 2 - PAGE_KEYS_PHONE_W / 2;
  return x0 + ((x1 - x0) * (k % 4)) / 3;
};
/** La rangee de l'encodeur k : k / 4 (au desktop aussi depuis la face V.4.0, 2026-10-27 ; une seule en V.2.0 et V.3.0). */
export const pageKnobRow = (k: number): number => (PAD_FACE && RYTM_FACE_VER !== '1.0' ? 0 : k >> 2);
/** Leurs noms sur la face et a l'ecran. */
export const GLOBAL_ENC_LABELS: readonly string[] = ['DIST', 'CHORUS', 'DELAY', 'REVERB', 'STRETCH', 'SWING', 'BIT', 'COMP'];

/**
 * Les six touches de page (2026-10-08, l'ordre de l'Analog Rytm : TRIG SRC
 * SMPL FLTR AMP FX ; rytm/pages.ts) : de petites touches a LED, leur nom
 * serigraphie dessous. Juste sous l'ecran depuis le 2026-10-09 (Mika :
 * "TRIG, je veux ces boutons en dessous de l'ecran"), six touches egales sur
 * toute la largeur du verre, comme celles d'une Digitakt sous son ecran ; au
 * telephone plus hautes (le doigt) et plus larges. La LED de la page choisie
 * est allumee (a peine en vue HOME : l'appui la rallume) ; la touche allumee
 * pressee encore : HOME.
 */
export const RYTM_PAGE_KEYS = [
  { id: 'voice', label: 'VOICE' },
  { id: 'fltr', label: 'FLTR' },
  { id: 'env', label: 'ENV' },
  { id: 'fx', label: 'FX' },
] as const;

export interface KeyLabelSpec {
  /** la touche : l'id d'une page (RYTM_PAGE_KEYS) ou d'un bouton du transport */
  id: string;
  text: string;
  x: number;
  z: number;
  /** la largeur et la profondeur de la touche */
  w: number;
  d: number;
  /** face V.4.0 (2026-10-27) : face (les douze touches de la rangee depuis V.4.2), scene (A, B), stepn et stepv (le numero et la voix sur un pas) */
  group: 'pkey' | 'tr' | 'face' | 'scene' | 'stepn' | 'stepv';
  /** l'encre au repos : celle de la serigraphie, ou l'os (RUN/STOP, sur son rouge, dans les deux apparences) */
  rest: 'ink' | 'bone';
  /**
   * La face V.4.0 (2026-10-27) : cap, la hauteur de capitale d'un texte (KEY_LABEL.cap sinon) ; qw, la largeur du quad
   * (la touche moins ses marges sinon) ; dz, le decalage du centre (KEY_LABEL.dz, ou KEY_MARK.dz pour des signes, sinon) ;
   * align, le texte centre ou cale a gauche de son quad (le numero d'un pas). V.4.2 (2026-10-27, facon Digitakt) :
   * tracking, l'interlettrage du texte en em (SILK.tracking sinon) ; marks, des signes imprimes a la place du texte
   * (RUN/STOP : le triangle PLAY et le carre STOP, KEY_MARK)
   */
  cap?: number;
  qw?: number;
  dz?: number;
  align?: 'center' | 'left';
  tracking?: number;
  marks?: readonly FpMark[];
  /** Le sous-titre dynamique sur la touche quand FUNC est engagee (Mika : "PRESET on appui sur FUNC et ca devient PERFORM") */
  altText?: string;
}

/**
 * Les signes de RUN/STOP sur leur touche (V.4.2, 2026-10-27, RYTM_FACEPLATE.buttons.marks) : leur hauteur, l'air entre
 * eux, leur centre un rien vers l'avant (le temoin est derriere) ; le triangle PLAY un rien moins large que haut.
 */
// chevron (V.6.0, la face DT2, cahier 2.3) : les fleches, < et > larges de narrow fois leur hauteur, ^ et v aussi larges
// que la hauteur des signes et hauts de narrow fois elle ; leur trait, line fois la hauteur des signes
export const KEY_MARK = { h: fpU(RYTM_FACEPLATE.buttons.marks.h), gap: fpU(RYTM_FACEPLATE.buttons.marks.gap), dz: fpU(RYTM_FACEPLATE.buttons.marks.dy), playW: 0.88, chevron: { narrow: 0.6, line: 0.15 } } as const;

/* ---------- serigraphie du panneau (spec 20.3.4 et 20.3.9) ---------- */

export interface SilkText {
  text: string;
  x: number;
  z: number;
  /** hauteur de capitale, en unites */
  cap: number;
  alpha?: number;
  align?: 'center' | 'left' | 'right';
  /** largeur max en unites : le corps reduit pour tenir (voisins, bords) */
  maxW?: number;
  /** les textes d'un meme groupe partagent le plus petit corps */
  group?: string;
  weight?: number;
  /**
   * encre : bone (defaut) ou orange (noms des pages et OPEN, en gras) ; alt (V.5.0, 2026-10-29) : l'orange des fonctions
   * secondaires de la Digitakt (DT_HEX.orange, plus sombre sur la machine creme)
   */
  ink?: 'bone' | 'orange' | 'alt';
  /** texte de repli d'un logo : dessine seulement si l'image du logo n'a pas pu se charger */
  fallbackFor?: SilkLogoId;
}

export type SilkLogoId = 'wordmark' | 'mark';

/**
 * Logos serigraphies sur le panneau (2026-09-30) : dessines dans la meme
 * texture que les legendes, ils suivent la machine en 3D. Le logo aligne
 * (wordmark, 971 x 57) prend la place du texte MAUDITE MACHINE en haut a
 * gauche ; le logotype (le M, 1891 x 1612) se pose en haut a droite, FIRMWARE V.3.0 /
 * 2026 a sa gauche. Images blanches, teintees a l'encre de la serigraphie.
 * x : bord d'alignement, z : centre ; w ou h fixe la taille (unites).
 */
/** L'en-tete du panneau : wordmark, MM-808, firmware et logotype (portrait : plus serres, en haut). */
/*
 * La face V.4.0 du desktop (2026-10-27, rytm/faceplate.ts silk, places provisoires) : le wordmark sous l'ecran a gauche,
 * MM-RYTM cale sur le bord droit du verre, FIRMWARE V.3.0 sous les potards, le logotype a droite au-dessus de SCENE B ;
 * chacun son z (au telephone, l'en-tete d'une ligne).
 */
const FP_SILK = RYTM_FACEPLATE.silk;
/*
 * La face DT2 (V.6.0, ?face=dt2, cahier 2.3) : le wordmark, MM-RYTM et le firmware passent sur le decalque du cadre de
 * l'ecran (scene/silk.ts BezelDecal lit DT2_FACEPLATE.silk.decal ; HEAD en garde les places pour le repli SVG), le M sur
 * la zone du logo dans la colonne gauche.
 */
const DT2_SILK = DT2_FACEPLATE.silk;
export const HEAD = PORTRAIT
  ? { word: { x: -3.75, z: -6.74, w: 3.0 }, model: { x: -0.55, z: -6.74, cap: 0.13, align: 'left' as const }, firmware: { x: 3.05, z: -6.74, cap: 0.06 }, mark: { x: 3.75, z: -6.74, h: 0.5 } }
  : PAD_FACE
    ? { word: { x: -5.75, z: -3.35, w: 3.4 }, model: { x: -2.1, z: -3.35, cap: 0.14, align: 'left' as const }, firmware: { x: 5.0, z: -3.35, cap: 0.065 }, mark: { x: 5.75, z: -3.35, h: 0.56 } }
    : DT2_FACE
    ? {
        word: { x: fpX(DT2_SILK.decal.wordmark.x), z: fpZ(DT2_SILK.decal.wordmark.cy), w: fpU(DT2_SILK.decal.wordmark.w) },
        model: { x: fpX(DT2_SILK.decal.model.x), z: fpZ(DT2_SILK.decal.model.cy), cap: fpU(DT2_SILK.decal.model.cap), align: 'right' as const },
        firmware: { x: fpX(DT2_SILK.decal.firmware.x), z: fpZ(DT2_SILK.decal.firmware.cy), cap: fpU(DT2_SILK.decal.firmware.cap) },
        mark: { x: fpX(DT2_SILK.mark.x), z: fpZ(DT2_SILK.mark.cy), h: fpU(DT2_SILK.mark.h) },
      }
    : {
        word: { x: fpX(FP_SILK.wordmark.x), z: fpZ(FP_SILK.wordmark.cy), w: fpU(FP_SILK.wordmark.w) },
        model: { x: fpX(FP_SILK.model.x), z: fpZ(FP_SILK.model.cy), cap: fpU(FP_SILK.model.cap), align: 'right' as const },
        firmware: { x: fpX(FP_SILK.firmware.x), z: fpZ(FP_SILK.firmware.cy), cap: fpU(FP_SILK.firmware.cap) },
        mark: { x: fpX(FP_SILK.mark.x), z: fpZ(FP_SILK.mark.cy), h: fpU(FP_SILK.mark.h) },
      };

/** Le libelle du pad OPEN (OPEN, CLOSE vue eclatee) : l'index de son texte dans SILK_TEXTS. */
const PAD_CAP = 0.09;
export const padLabel = (p: PadSpec): SilkText =>
  p.kind === 'voice'
    ? { text: p.label, x: p.x, z: p.z + PAD.labelDz, cap: PAD_CAP, maxW: 0.94, group: 'pads' }
    : p.kind === 'edit'
      ? { text: p.label, x: p.x, z: p.z + PAD.labelDz, cap: PAD_CAP, maxW: 0.94, group: 'pads', weight: 700 }
      : { text: p.label, x: p.x, z: p.z + PAD.labelDz, cap: PAD_CAP, maxW: 0.94, group: 'pads', weight: 700, ink: 'orange', alpha: 1 };
