/**
 * L'ecran OLED en haut a gauche du panneau (spec 20.3.8) : un plan de
 * 3.6 x 1.35 pose sur son cadre, texture canvas (les proportions du verre).
 *
 * Refait le 2026-10-07 (Mika : "l'ecran du MM-RYTM, je le trouve brouillon,
 * il y a des infos que je ne veux pas voir, c'est trop vieille machine ; je
 * ne veux pas de couleurs dessus, mais j'aimerais un design a la Teenage
 * Engineering OP-1") : plus de police de pixels ni de lignes de texte, un
 * dessin vectoriel net, noir et os seulement (trois intensites : plein,
 * demi, a peine), de grandes formes, tres peu de mots. Mise en page en
 * unites de 320 x 120 :
 * - a gauche, l'anneau des seize pas (le motif de la voix choisie ; sans
 *   voix, le motif entier en demi-teinte) : un point par pas, plus gros
 *   avec la velocite, les temps 1 5 9 13 marques ; la tete de lecture, un
 *   cercle autour du pas qui joue et un trait vers lui ; un coup qui sonne
 *   pulse. Au centre, la voix en grand et son son (909, 808, MM, un
 *   sample), ou MUTE, SOLO ;
 * - a droite, en haut : la lecture (un triangle, un carre a l'arret), le
 *   pattern (il clignote quand il change), le tempo ;
 * - dessous, trois reglages dessines comme sur l'OP-1, chacun son image :
 *   la voix choisie (VOLUME en barres qui montent, TONE en courbe de
 *   filtre qui bascule, DECAY en enveloppe qui s'allonge), sans voix la
 *   machine (SWING en paires de points decalees, STRETCH, MASTER) ;
 * - tout en bas a droite : le message du moment (la valeur d'un potard, un
 *   pas pose), ou la piste qui joue et sa barre (cliquable, bar), sinon rien.
 * EDIT (state/patterns.ts) : l'anneau porte les seize patterns (le courant
 * plein, la chaine reliee, celui qui attend clignote), le pattern en grand
 * au centre. MIX : les volumes de la rangee en faders. SAMPLES : la liste
 * des sons, le courant en pastille. PRESETS : le nom en grand, ses touches.
 * Au repos (desktop, la machine regardee), de temps en temps, une vague
 * lente passe sur l'anneau. Le texte vient de state/lcd.ts (le jumeau le
 * lit) ; l'image se refait quand un store change, au plus tous les 60 ms,
 * et ne demande une frame qu'apres un redessin. Materiau non eclaire, sans
 * tone mapping.
 *
 * La vue PAGE (2026-10-08, la refonte facon Digitakt, Mika : "8 encodeurs
 * assignables a condition de presser les bonnes touches ; l'ecran divise en
 * 8 blocs" ; puis, le meme jour : "RYTM : je ne vois AUCUN changement de ce
 * que j'ai demande ! les valeurs de knobs sont a l'ecran, pas sur les
 * encodeurs, de 0 a 127 ; je veux des ecrans super evolues") : l'ecran PAR
 * DEFAUT, tout le temps (state/rytmPage.ts) ; l'ecran ci-dessus (HOME, au
 * pixel pres) revient par la touche de la page allumee ou H. Dans la meme
 * langue OP-1 :
 * - en haut, la lecture, la page en pastille (SRC), la voix et son son ; a
 *   droite le pattern et le tempo ; un filet dessous ;
 * - huit blocs en 2 x 4 (A B C D, E F G H), chacun exactement au-dessus du
 *   potard de page du meme nom (theme.ts pageKnobX) : un cadre a peine, son
 *   nom et la lettre du potard, sa valeur en grand de 0 a 127 (-64 a +63 a
 *   zero au centre, le nom du cran pour un choix : 909, BLUEPRINT, ON), la
 *   ligne d'unite dessous (216 MS, -3.2 DB, rytm/values.ts), sa petite image
 *   (barres, courbe, enveloppe, petit potard) qui bouge avec la valeur ; un
 *   reglage a venir a peine (--, SOON), celui qu'on vient de tourner cerne
 *   (l'echo), ALL ou NO BD pour ceux de toute la machine ;
 * - le pied : a gauche les seize pas de la voix et la tete de lecture (on
 *   voit le sequenceur passer), a droite le message (BD DECAY 64  640 MS),
 *   la piste (sa barre cliquable, OLED_BAR_PAGE), MUTE et SOLO, sinon les
 *   six pages, celle affichee en pastille.
 * La liste des sons (SAMPLES) y prend toute la largeur ; la page MIX reste a
 * HOME. Les coups qui pulsent et la vague du repos n'y redessinent rien ; la
 * tete de lecture, si (les seize pas du pied), au plus tous les 60 ms.
 *
 * Les verrous (2026-10-08, l'etape R2 des parameter locks, Mika : "on voit a
 * l'ecran que quand le sequenceur passe sur ce step alors le changement est
 * fait ; fait evoluer l'ecran, c'est la cle de ce que je demande") :
 * - en LOCK (un pas tenu, ou fixe, state/rytmLock.ts) : l'en-tete porte la
 *   pastille LOCK 05 (pleine, un petit cadenas) et la page en contour ; un
 *   bloc verrouille sur ce pas passe en negatif (plein, texte noir, le
 *   cadenas) avec sa valeur verrouillee ; un bloc verrouillable mais pas
 *   verrouille montre la valeur de la voix en retrait ; ceux de toute la
 *   machine (GLOBAL) et ceux pas encore verrouillables (NO LOCK), a peine ;
 *   le pied dit quoi faire (TURN A KNOB: STEP 05 ONLY, 2X: UNLOCK, CLEAR:
 *   ALL) ou les verrous du pas ;
 * - en lecture : quand le pas qui joue a des verrous, leurs blocs passent en
 *   negatif avec la valeur verrouillee jusqu'au coup suivant de la voix (au
 *   moins 280 ms depuis la revue de R2), puis reviennent ;
 * - le panneau des verrous (revue de R2) : en LOCK et quand le pas joue, tous
 *   ses verrous ecrits, toutes pages, dans la place que la page laisse vide ;
 *   au desktop un point sur l'onglet des pages qui en portent, au telephone
 *   leur liste au pied (et sinon, toujours, le geste : HOLD A STEP + TURN A
 *   KNOB) ;
 * - les seize pas du pied : un trait court sous chaque pas qui a des verrous,
 *   le pas en LOCK cerne ; l'anneau de HOME, un trait dehors.
 *
 * L'etape 2 (2026-10-09, Mika : "je veux merge SRC SMPL et TRIG ... AMP doit
 * s'appeler ENV ... les FX du Voice selectionne mais aussi les FX Globaux" ;
 * "les encodeurs ne servent qu'a faire les modifs des FX globaux" ; "les
 * P-LOCKs doivent etre evidents") : quatre pages (VOICE FLTR ENV FX), leurs
 * onglets en pastilles dans l'en-tete (VOICE MAIN / SYNTH, FX VOICE / GLOBAL,
 * tapables : tabSpots) ; les blocs poses dans la grille de 4 x 2 avec leur
 * taille (pages.ts slotCells : SOUND large, le dessin AHD de ENV sur trois
 * cases, les FX de la voix hauts) ; l'ecran est l'editeur au desktop aussi
 * (blockRects : les zones lcd-blk-k, le cadre de survol) ; en P-LOCK l'en-tete
 * entier passe en negatif (P-LOCK STEP 05, l'ecran en contour, le compte des
 * verrous), chaque bloc verrouille porte un P dans son coin, et pendant la
 * lecture une pastille P-LOCK clignote quand le pas qui joue a des verrous ;
 * un encodeur du desktop pose un popup (GLOBAL DELAY 64 et son unite)
 * par-dessus les blocs un instant (paintPopup) ; MUTE et SOLO disent leur
 * etat au pied (modeLines).
 * Les dessins des blocs passent par une palette (pal) : la normale, ou la
 * negative d'un bloc plein ; HOME garde la normale, au pixel pres.
 *
 * La touche i (2026-10-08, l'etape R4, Mika : "je veux un petit bouton i dans
 * l'ecran a activer et de ce fait on peut voir les infos au survol.. et je
 * veux la meme chose pour RYTM aussi !") : un i cercle dans le coin en haut a
 * droite, sur toutes les vues (PAGE, HOME, EDIT, les presets), plein quand
 * INFOS est allume (state/rytmInfos.ts) ; le pattern et le tempo se rangent a
 * sa gauche. Sa zone de saisie (lcd-i, scene/renderer.ts) est posee sur
 * INFO_KEY. INFOS allume, le bloc de l'encodeur dont la carte est montree
 * porte quatre coins (la carte et l'ecran parlent du meme bloc).
 *
 * Le telephone (2026-10-09, Mika : "en mobile c'est mieux si tu ne mets pas
 * d'encoders ; on change dans l'ecran directement ; forcement donne-moi un
 * ecran plus grand") : les potards de page ont quitte la face, l'ecran prend
 * toute la largeur et plus de hauteur (theme.ts OLED_UH, 158 unites) ; la vue
 * PAGE y a sa mise en page haute (TALL : blocs de 52.5, corps plus gros, le
 * pied en bas) et ses huit blocs sont les commandes (scene/renderer.ts
 * lcd-blk, ui/Hotspots.tsx : glisser, deux tapes, le LOCK a deux doigts) ; le
 * bloc tenu au doigt reste cerne (state/rytmPage.ts held) ; les aides disent
 * DRAG A VALUE. HOME, EDIT et les presets gardent leur dessin de 120, centre.
 *
 * Le navigateur des sons (2026-10-18, Mika : "Je trouve ca difficile la
 * selection des samples dans RYTM, y aurait-il une autre facon ?") : la liste
 * de trois lignes d'avant (SAMPLES, 2,4 s) devient toute la liste de SOUND de
 * la voix, sur tout l'ecran, en vue PAGE comme a HOME (paintBrowser, actions.ts
 * soundBrowserView) : l'en-tete (la voix, le rang 7 / 24, PREV et NEXT), autant
 * de lignes que l'ecran en tient (le son du moment en pastille pleine, la ligne
 * du clavier cernee, une ligne qui va partir en contour), une fine barre de
 * defilement, le pied des seize pas et du message ; ses zones (browserRects :
 * lcd-sb-*) remplacent celles des blocs. Un fichier glisse au-dessus de la
 * machine pose DROP ON A PAD par-dessus tout (paintDrop).
 *
 * Le menu de la voix (2026-10-18, Mika : "j'aime bien cet affichage par defaut
 * quand je selectionne un Voice .. et je veux voir le menu dans l'ecran pour
 * modifier le voice") : HOME redevient l'ecran de depart (state/rytmPage.ts) et
 * porte, dans la bande sous son dessin de 120, cinq touches : SOUND (la liste des
 * sons de la voix) puis VOICE FLTR ENV FX, les pages de la voix (paintHomeMenu,
 * menuRects : les zones lcd-menu-<id>).
 *
 * MASTER et TEMPO (2026-10-19, Mika : "mets ces boutons dans l'ecran en mobile
 * et en desktop, je voudrais qu'ils soient mieux faits") : les deux potards
 * d'aluminium ont quitte la face, ils sont dessines en haut a droite de
 * l'ecran, a gauche de la touche i, a la meme place sur HOME (la bande au-dessus
 * de son dessin de 120) et dans l'en-tete de la vue PAGE (paintDials) : le
 * pattern, MASTER (un vumetre de sept barres qui montent jusqu'au niveau, son
 * niveau en dB quand la place le permet) et TEMPO (le nombre, BPM, sa course
 * sur un fin trait dessous, de 100 a 150). Chacun se glisse de haut en bas,
 * comme un bloc (ses zones : dialRects, lcd-master et lcd-tempo) ; cerne a
 * peine sous la souris, plein tant qu'on le tient (state/screenDials.ts).
 * Ni en P-LOCK (l'en-tete y est le bandeau du pas), ni dans EDIT, les presets
 * ou la liste des sons.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { disposeSheen, glassSheen } from './glassSheen';
import { clock } from '../audio/clock';
import { compGr, mix } from '../audio/drums';
import { KIT_MODEL_LABEL, familyOf, kit, type KitFamily, type Plays } from '../audio/kit';
import { onSampleStatus, sampleByKey, samplesChanged } from '../audio/samples';
import { INSTRUMENTS, STEP_COUNT, VEL_BARS, pattern, velocity } from '../audio/pattern';
import { tempoSync } from '../state/tempoSync';
import { lockMask, lockOf, type StepLock } from '../audio/locks';
import { dialRange, dialShown, dialUnit, dialValueText, stepWrites, lockCountOf, lockList, lockPages, lockSummary, soundBrowserView, stepPlays, voiceSoundText, type DialId, type LockLine, type SoundBrowserView } from '../actions';
import { rytmLock } from '../state/rytmLock';
import { sceneCtl } from '../state/sceneCtl';
import { anyScenes, sceneCount, type SceneId } from '../rytm/sceneData';
import type { ShotId } from '../audio/shotsdsp';
import { sc } from '../audio/soundcloud';
import { FENV_OCT, atkS, cutHz, decayTau, holdS, voiceFx } from '../audio/voicefx';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { lcd, type LcdState } from '../state/lcd';
import { lcdMessage } from '../state/lcdMessage';
import { BROWSER_ROWS, lcdSamples } from '../state/lcdSamples';
import { BANKS, BANK_SIZE, bankName, bankOf, patterns, slotName } from '../state/patterns';
import { ctlAllState } from '../state/trk';
import { playhead } from '../state/playhead';
import { rytmInfos } from '../state/rytmInfos';
import { rytmPage, type RytmPageState, type RytmView } from '../state/rytmPage';
import { voices } from '../state/voices';
import { dtFace } from '../state/dtFace';
import { DT_FACE, FONT_DISPLAY, GLOBAL_ENCODERS, GLOBAL_ENC_LABELS, HEX, OLED, OLED_BAR, OLED_DY, OLED_UH, PORTRAIT, SCREEN_TOUCH, XFADE_UI, type EncId, type Inst } from '../theme';
import { PRESET_SLOTS } from '../state/presetMode';
import { softKeyName, softKeyPitchU, softKeyU } from '../rytm/presetKeys';
import { rytmInfoHit } from '../rytm/infoIds';
import { FACE_PAGES, HOME_MENU, HOME_MENU_LABEL, RYTM_SCREENS, SCREEN_LABEL, isRytmPage, SCREEN_PAGE, SCREEN_TITLE, freeCells, fxScopeTabs, fxVoiceTabLabel, isFxDetail, pageLabel, pageSlots, screensOf, tabWord, type PageSlot, type RytmPageId, type RytmScreenId, type SlotCell } from '../rytm/pages';
import { pageBlocks, screenIn, type Block, type BlockMode } from '../rytm/pageView';
import { encUnit, v127Text } from '../rytm/values';
import { screenDials, type ScreenDialId } from '../state/screenDials';
import { makeCanvasTexture, onFonts } from './silk';
import { CONDS, RATE_DENS, rtrgGain } from '../audio/trig';
import { LFO_WAVES, waveAt } from '../audio/lfo';
import { fill } from '../state/fill';

export interface ScreenInfo {
  /** redessins de la texture (le premier compris) */
  draws: number;
  /** les trois lignes du texte (le jumeau les lit) */
  text: [string, string, string];
  /** performance.now() du dernier redessin */
  lastDrawAt: number;
  /** plus petit ecart mesure entre deux redessins (ms) : jamais sous MIN_GAP_MS */
  minGapMs: number;
  font: string;
  size: [number, number];
  /** ce que montre l'ecran (2026-10-08) : HOME, la vue PAGE, EDIT, les presets ; le navigateur des sons (2026-10-18) */
  view: RytmView | 'edit' | 'presets' | 'browser';
  /** les presets dessines (2026-10-27) : la ligne d'avant | le curseur | la ligne d'apres | les touches ; '' ailleurs */
  presetList: string;
  /** le preset charge nomme en tete de HOME (2026-10-27, une etoile s'il a bouge) ; '' : rien */
  presetHead: string;
  /** la page du MM-RYTM (dessinee en vue PAGE) */
  page: RytmPageId;
  /** les blocs dessines en vue PAGE, NOM=VALEUR:etat ; [] ailleurs */
  blocks: string[];
  /** le bloc cerne (l'echo) dessine, -1 aucun */
  echo: number;
  /** le pas en LOCK dessine (2026-10-08), -1 aucun */
  lock: number;
  /** les blocs en negatif pour le pas qui joue (ses verrous) */
  flash: number[];
  /** les seize pas du pied : . vide, o un coup, L un coup verrouille, l des verrous sans coup ; * le pas en LOCK */
  strip: string;
  /** les lignes du pied en LOCK */
  foot: string[];
  /** le panneau des verrous du pas (en LOCK, ou le pas qui joue) dans la place vide de la page : ses lignes */
  panel: string[];
  /** le pied hors LOCK : le message, les verrous du pas qui joue, l'aide (telephone), les onglets ; '' rien */
  footText: string;
  /** les deux couches de la voix dans l'en-tete de SRC et SMPL (R3, revue) : SYN 909 OFF | SMP BLUEPRINT 127 ; '' ailleurs ou sans la place */
  layers: string;
  /** la touche i dessinee pleine : INFOS allume (R4) */
  infos: boolean;
  /** le bloc marque des quatre coins (INFOS : la carte de son encodeur est montree), -1 aucun */
  infoBlock: number;
  /** l'ecran dessine (2026-10-09 : la page et son onglet, VOICE, SYNTH, FLTR, ENV, FXV, FXG) */
  screen: RytmScreenId;
  /** les cases des blocs dessines (colonne, rangee, largeur, hauteur) */
  cells: string[];
  /** le bloc sous la souris dessine (desktop), -1 aucun */
  hover: number;
  /** le popup d'un encodeur du desktop dessine (GLOBAL DELAY 64 64%) ; '' aucun */
  popup: string;
  /** l'en-tete : la page et ses onglets (VOICE|[MAIN]|SYNTH), ou en P-LOCK son texte (P-LOCK STEP 05 | ENV · P-LOCKS) */
  head: string;
  /** la bande du crossfader au pied (2026-10-27, P2-20) : A 0.50 B (REC A, une scene armee) ; '' pas dessinee */
  xfade: string;
  /** le compte des verrous du pas en P-LOCK dans l'en-tete (-1 hors P-LOCK) */
  lockCount: number;
  /** M ou S quand MUTE ou SOLO est arme (M+ : MULTI) ; '' sinon */
  badge: string;
  /** ce que chaque bloc dessine sous sa valeur (revue du 2026-10-09) : NOM:unite|etiquette@name ou @unit */
  tags: string[];
  /** le dessin d'un ecran (ENV : AHD ..., FLTR : FILTER ...) ; '' aucun */
  graph: string;
  /**
   * le navigateur des sons dessine (2026-10-18) : son titre, son rang, la premiere ligne, le son du moment, la ligne du
   * clavier ; ses lignes NOM, * le son du moment, > la ligne du clavier, ! armee (REMOVE?), u un sample de ce navigateur ;
   * null : ferme
   */
  browser: { title: string; rank: string; top: number; cur: number; cursor: number; rows: string[] } | null;
  /** l'annonce d'un fichier glisse au-dessus de la machine (DROP ON A PAD, DROP ON BD) ; '' aucune */
  drop: string;
  /** le menu de la voix dessine sous HOME (2026-10-18) : SOUND VOICE FLTR ENV FX, -SOUND a peine (sans voix) ; [] ailleurs */
  menu: string[];
  /**
   * MASTER et TEMPO dessines (2026-10-19) : MASTER -3.9 DB (ou MASTER 6/7 sans la place du nombre : ses barres
   * allumees) | TEMPO 130 BPM, et * sur celui qui est cerne (tenu), ~ survole ; '' quand ils ne sont pas a l'ecran
   */
  dials: string;
  /** le pattern dessine a leur gauche (A01), '' s'il a cede sa place */
  dialSlot: string;
  /**
   * les places fixes de l'en-tete de la vue PAGE (2026-10-22, audit SB-13) : le palier des cadrans (A01, A01+DB, -),
   * la colonne de la voix (voice@148.8), le palier de serrage des onglets (fit0 a fit3, ! rien ne tient), |DB quand
   * MASTER tenu dit son niveau ; '' hors de la vue PAGE et en P-LOCK
   */
  headFit: string;
  /** les points de page sous la pastille (2026-10-27, desktop, une page a deux onglets) : 1/2, 2/2 ; '' aucun */
  pageDots: string;
}


/** Au plus un redessin tous les 60 ms (un potard tourne a la cadence du pointeur). */
const MIN_GAP_MS = 60;
/** Les animations courtes : une image tous les 50 ms. */
const ANIM_MS = 50;
/** L'aiguille du COMP sur sa page (2026-10-18) : une image toutes les 50 ms tant qu'elle bouge. */
const METER_MS = 50;
const BLINK_MS = 600;
/** Un coup qui sonne : il pulse PULSE_MS. */
const PULSE_MS = 260;
/** La vague du repos : apres IDLE_MS sans rien, WAVE_MS de vague (desktop). */
const IDLE_MS = 15000;
const WAVE_MS = 7000;

/**
 * La mise en page, en unites : 320 de large ; 120 de haut au desktop, 158 au
 * telephone depuis le 2026-10-09 (theme.ts OLED_UH, Mika : "forcement
 * donne-moi un ecran plus grand") : la vue PAGE y a sa mise en page haute
 * (TALL : des blocs de 52.5 au lieu de 37, de plus gros corps, un pied de 26),
 * les autres vues (HOME, EDIT, les presets) gardent leur dessin de 120,
 * centre (OLED_DY). Le desktop aussi depuis le 2026-10-18 (Mika : "RYTM je
 * voudrais un ecran plus grand") : le meme dessin haut sur un verre plus grand
 * (theme.ts OLED, 5.3 x 2.617) ; ce qui tient au doigt reste au telephone
 * (PORTRAIT : les lignes du navigateur, SB), le reste suit TALL.
 * La face V.4.0 du desktop (2026-10-27, Mika : "ecran 4.3 pouces 800 x 480") :
 * 320 x 192 unites (5:3, la dalle de la machine), une toile de 1600 x 960 (deux
 * fois la dalle) ; les 34 unites de plus (GROW) vont aux blocs de la vue PAGE
 * (72 x 69.5), a leur dessin et aux neuf lignes du navigateur des sons ; HOME,
 * EDIT et les presets restent centres (DY 36), le pied et l'en-tete suivent UH.
 */
const UW = 320;
const UH = OLED_UH;
const TALL = UH > 120;
const DY = OLED_DY;
/**
 * La hauteur gagnee par l'ecran 5:3 du desktop V.4.0 (2026-10-27, Mika : "ecran 4.3 pouces 800 x 480") : 320 x 192
 * unites au lieu de 320 x 158, 34 unites de plus ; 0 au telephone. Les blocs de la vue PAGE et les lignes du navigateur
 * des sons la prennent ; le reste (l'en-tete, le pied, HOME centre par DY) suit deja UH.
 */
const GROW = UH - 158;

/**
 * La touche i (R4, 2026-10-08), en unites : son centre, dans le coin en haut
 * a droite, et son rayon dessine ; hit : le rayon de sa zone de saisie (au
 * telephone 26 unites, 45 px CSS a 390 x 844 : le contrat veut 44 ; elle mord
 * le tempo de l'en-tete, qui ouvre les presets). INFOS allume, les blocs de
 * la vue PAGE ont leur zone (lcd-blk) : au telephone, sa zone se centre alors
 * sur le coin du verre (blocks, revue de R4 : elle mordait le coin du bloc D,
 * de 236 a 308 sur 24 a 61), toujours aussi large et le i dedans.
 * scene/renderer.ts pose la zone lcd-i avec.
 */
/**
 * Le mode presets (2026-10-27, la V.4.2), en unites, sur toute la hauteur de l'ecran : la ligne du titre (head), les
 * trois lignes de la liste (avant, le curseur, apres), le nom en cours et son aide (sub, hint), et la rangee des cinq
 * touches (keyY, son centre ; keyH, la hauteur d'une pastille). Au desktop les pastilles sont au-dessus des touches de la
 * face qu'elles nomment (rytm/presetKeys.ts) ; au telephone, en cinquiemes, assez grandes pour le doigt.
 */
export const PRESET_LAYOUT = PORTRAIT
  ? { head: 17, rows: [44, 74, 99], sub: 99, hint: 112, keyY: 133, keyH: 20, keyFont: 9.5 }
  : { head: 20, rows: [56, 92, 122], sub: 122, hint: 142, keyY: 172, keyH: 16, keyFont: 8 };

/**
 * Ou est la touche i (0 a 4, PRESET_SLOTS) du mode presets sur la largeur de l'ecran, de 0 a 1 : son centre et sa zone.
 * Au desktop, au-dessus de la touche de la face qu'elle nomme ; au telephone, le cinquieme de la largeur.
 */
export function presetKeySpot(i: number, mobile: boolean = PORTRAIT): { u: number; u0: number; u1: number } {
  if (mobile) return { u: (i + 0.5) / 5, u0: i / 5, u1: (i + 1) / 5 };
  const u = softKeyU(PRESET_SLOTS[i]);
  const half = softKeyPitchU() / 2;
  return { u, u0: Math.max(0, u - half), u1: Math.min(1, u + half) };
}

export const INFO_KEY = { x: UW - 8, y: 10.5, r: { desk: 5.2, phone: 6.6 }, hit: { desk: 8, phone: 26 }, blocks: { x: UW, y: 0 } } as const;

/**
 * Le bloc k de la vue PAGE sur le verre (u, v de 0 a 1) : INFOS allume, sa
 * zone (lcd-blk-<k>, scene/renderer.ts) montre la carte de son encodeur au
 * survol ou au toucher (R4 : on regarde l'ecran, pas le potard).
 */
export function blockSpot(k: number): { u0: number; u1: number; v0: number; v1: number } {
  const x = MATRIX.x0 + MATRIX.pitch * (k % 4);
  const y = MATRIX.rows[k >> 2];
  return { u0: x / UW, u1: (x + MATRIX.w) / UW, v0: y / UH, v1: (y + MATRIX.h) / UH };
}

/**
 * La zone de la touche i sur le verre : son centre (u, v de 0 a 1) et son
 * rayon en part de la largeur de l'ecran ; blocks : les blocs ont leur zone
 * (au telephone, elle s'ecarte du bloc D ; au desktop, elle ne le touche pas).
 */
export const infoKeySpot = (mobile: boolean, blocks = false): { u: number; v: number; r: number } => {
  const away = mobile && blocks;
  return {
    u: (away ? INFO_KEY.blocks.x : INFO_KEY.x) / UW,
    v: (away ? INFO_KEY.blocks.y : INFO_KEY.y) / UH,
    r: (mobile ? INFO_KEY.hit.phone : INFO_KEY.hit.desk) / UW,
  };
};
/**
 * 2026-10-22 (audit SB-02, RS-11) : au telephone, les zones de saisie de l'en-tete (les onglets, MASTER et TEMPO, PREV et
 * NEXT du navigateur) montent de tant d'unites au-dessus du verre (22 px a 390 de large ; rien a toucher sur cette
 * bordure) : 40 px de haut au lieu de 20. La zone n'a pas a egaler le dessin.
 */
const HEAD_HIT_UP = 24;

/** Les coordonnees de texture du reste du site (theme OLED.tex, 640 x 240) : deux par unite. */
const TEX_K = OLED.tex[0] / UW;

/** L'os, et ses deux intensites eteintes (sur le noir de l'OLED). */
const INK: string = HEX.bone;
const HALF: string = 'rgba(246, 241, 231, 0.5)';
const FAINT: string = 'rgba(246, 241, 231, 0.2)';
/**
 * 2026-10-22 (audit SB-07) : le texte a peine (onglets inactifs, aides, PICK A VOICE), 0.4 soit plus de 3:1 sur le noir ;
 * FAINT (0.2, 1.65:1) reste aux filets, cadres et decors : l'onglet SYNTH ou GLOBAL ne disparaissait plus en 3D.
 */
const FAINT_TEXT: string = 'rgba(246, 241, 231, 0.4)';
const BLACK: string = HEX.oled;
/** Le cadre d'un bloc de la vue PAGE : a peine (un reglage a venir, encore moins). */
const FRAME: string = 'rgba(246, 241, 231, 0.14)';
const FRAME_DIM: string = 'rgba(246, 241, 231, 0.07)';

/**
 * La palette des dessins (2026-10-08) : la normale (l'os sur le noir), ou la
 * negative d'un bloc verrouille (le noir sur l'os plein) ; bg : le fond.
 */
interface Pal {
  ink: string;
  half: string;
  faint: string;
  /** le texte a peine (2026-10-22, FAINT_TEXT) */
  faintText: string;
  bg: string;
}
const PAL: Pal = { ink: INK, half: HALF, faint: FAINT, faintText: FAINT_TEXT, bg: BLACK };
const PAL_NEG: Pal = { ink: BLACK, half: 'rgba(0, 0, 0, 0.58)', faint: 'rgba(0, 0, 0, 0.24)', faintText: 'rgba(0, 0, 0, 0.42)', bg: INK };

/** L'anneau des pas : son centre, son rayon ; la colonne de droite. */
const RING = { cx: 60, cy: 60, r: 47 } as const;
const COL = { x0: 124, x1: 314 } as const;
/** Les trois reglages : la zone de leur image, leur nom, leur valeur. */
const CARD = { y0: 30, y1: 64, label: 74, value: 90, gap: 8 } as const;
/** La ligne du bas (message, piste). */
const LINE = { y: 110 } as const;
/**
 * Le menu de HOME au telephone (2026-10-22, audit SB-02) : ses zones montent jusque sous les valeurs des cartes (dans le
 * dessin de 120 : le haut de l'ecran est a DY), 39 px de haut au lieu de 14 ; lcd-open (les presets) s'arrete plus haut,
 * a la bande de la piste (theme.ts OLED_BAR), et la touche de page sous le verre ne prend plus une tape un peu basse.
 */
const MENU_HIT_TOP = CARD.value + 6;
/** La largeur d'une carte de HOME ((190 - 2 x 8) / 3) : les images des blocs, plus petites, s'y rapportent. */
const CARD_W = 58;

/** Une zone de dessin, en unites. */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** La place du panneau des verrous dans la matrice : sa premiere colonne, combien, sa premiere rangee, combien. */
interface PanelArea {
  c0: number;
  n: number;
  r0: number;
  rows: number;
}

/*
 * La vue PAGE (2026-10-08) : huit blocs de 72 x 37 en 2 x 4, les centres des
 * colonnes (44, 120, 196, 272) au-dessus des potards de page ; dans un bloc
 * le nom et la lettre du potard en haut, la valeur en grand (16, puis 13, 11
 * et 9 pour tenir), la ligne d'unite dessous, l'image a droite de la
 * valeur, l'etiquette ALL ou NO BD au bout de la ligne d'unite.
 */
/*
 * Au telephone (TALL, 2026-10-09) : des blocs de 72 x 52.5 (37 avant), 44 px
 * de haut a 390 x 844, assez pour un doigt (ils sont les potards de page) ;
 * la valeur plus grande, l'image un peu plus petite a sa droite. Les deux
 * rangees a 3 l'une de l'autre (4 avant la revue du meme jour : le pied y
 * gagne sa place, 132 a 158).
 */
// L'ecran 5:3 du desktop (2026-10-27) : les blocs prennent les 34 unites de plus, moitie chacun (72 x 69.5, la grille finit a UH - 26)
const MATRIX: { x0: number; pitch: number; w: number; h: number; rows: readonly [number, number]; r: number } = TALL
  ? { x0: 8, pitch: 76, w: 72, h: 52.5 + GROW / 2, rows: [24, 24 + 52.5 + GROW / 2 + 3], r: 4.5 }
  : { x0: 8, pitch: 76, w: 72, h: 37, rows: [24, 63], r: 3.5 };
// valueW au telephone 39 (revue du 2026-10-09 : 127 touchait le dessin a 42 ; a trois chiffres la valeur prend le corps d'en dessous).
// L'ecran 5:3 (la revue du 2026-10-27) : le bas du dessin a 37 + 0.3 GROW (47.2), l'air du telephone au-dessus de la
// ligne d'unite (57.5) ; a 0.6 GROW il descendait jusqu'a elle, sur FROM TOP, BOTH et l'unite de MIX
const BLOCK: { padX: number; valueW: number; draw: { dx0: number; dx1: number; dy0: number; dy1: number } } = TALL
  ? { padX: 6, valueW: 39, draw: { dx0: 49, dx1: 67, dy0: 20 + GROW * 0.2, dy1: 37 + GROW * 0.3 } }
  : {
      padX: 5,
      /** la largeur de la valeur avant l'image */
      valueW: 34,
      draw: { dx0: 42, dx1: 67, dy0: 13, dy1: 29 },
    };
/**
 * Les corps de la vue PAGE (2026-10-08, revue de R1, Mika : "plus gros, plus
 * de detail ; super responsive en mobile") : l'ecran fait 465 px de large au
 * desktop (1.45 px l'unite) et 280 px au telephone (0.88 px l'unite) ; au
 * telephone le nom a 10 et l'unite a 8.6 (7.5 a 8.5 px a l'ecran ; 6.5 et
 * 5.5 n'y faisaient pas 5 px), la valeur a 17 ; ni lettre de potard dans le bloc
 * (elle est imprimee a cote du potard), ni crans au bout de l'unite, ni les
 * six onglets du pied (la touche allumee et la pastille de l'en-tete disent
 * la page) : la place va au texte.
 */
const BLOCK_TYPE = {
  desk: {
    nameSize: 7,
    letterSize: 5.5,
    unitSize: 6,
    /** l'etiquette d'un bloc (BOTH, MACHINE, NO BD...) : sa place (le bout de la ligne du nom ou de l'unite) et son corps */
    tagAt: 'name' as 'name' | 'unit',
    tagSize: 5.2,
    valueSizes: [17, 14, 12, 10],
    nameDy: 9.5,
    valueDy: 27.5,
    unitDy: 34.6,
    letters: true,
    notchRow: true,
    /*
     * Plus d'onglets au pied depuis la revue du 2026-10-09 : les six touches de
     * page sont juste sous le verre, sur sa largeur (Mika : "TRIG, je veux ces
     * boutons en dessous de l'ecran") ; leurs six noms repetes dans le pied, sur
     * sa droite seulement, ne tombaient sur aucune touche. Le pied dit ce que
     * dit celui du telephone (le pas verrouille qui joue, le geste des verrous).
     * Le dessin et les zones des onglets (lcd-tab-*) restent : tabs les rallume.
     */
    tabs: false,
    tabSize: 6.5,
    foot: 8,
    head: { pill: 7.5, pillH: 12, voice: 12, sound: 7.5, bpm: 6.5, num: 12 },
    selR: 0.9,
    /** le panneau des verrous : son corps, son interligne ; le cadenas d'un bloc verrouille, sa place */
    panelSize: 6.8,
    panelLh: 8.2,
    lockS: 4.6,
    lockW: 7,
    lockDx: 5.5,
  },
  phone: {
    nameSize: 10,
    letterSize: 0,
    unitSize: 8.6,
    tagAt: 'unit' as 'name' | 'unit',
    tagSize: 8.6,
    valueSizes: [17, 14.5, 12, 10],
    nameDy: 10.2,
    // L'unite plus haut (revue de R2 : CENTER, -8.2 DB touchaient le bord du bloc)
    valueDy: 25.9,
    unitDy: 33.5,
    letters: false,
    notchRow: false,
    tabs: false,
    tabSize: 0,
    foot: 9.5,
    head: { pill: 9, pillH: 13.5, voice: 13, sound: 9, bpm: 8, num: 13 },
    selR: 1.3,
    panelSize: 9,
    panelLh: 10.4,
    lockS: 6,
    lockW: 7,
    lockDx: 5.5,
  },
  /*
   * L'ecran haut du telephone (2026-10-09, Mika : "donne-moi un ecran plus
   * grand") : 293 px de large et 129 de haut a 390 x 844 (280 x 105 avant),
   * des blocs de 66 x 44 px (62 x 31 avant) ; le nom a 11.5 (10 px a
   * l'ecran), la valeur a 26 (24 px), l'unite a 9.5 ; l'en-tete et le pied un
   * rien plus gros aussi.
   */
  tall: {
    nameSize: 11.5,
    letterSize: 0,
    // L'unite et l'etiquette a 10 (revue du 2026-10-09 : 9.5 faisaient moins de 9 px a l'ecran, 69-common2 point 6)
    unitSize: 10,
    tagAt: 'unit' as 'name' | 'unit',
    tagSize: 10,
    valueSizes: [26, 23, 19, 15],
    nameDy: 12.5,
    valueDy: 36.5,
    unitDy: 47.3,
    letters: false,
    notchRow: false,
    tabs: false,
    tabSize: 0,
    foot: 10.5,
    head: { pill: 10, pillH: 14.5, voice: 14.5, sound: 10, bpm: 9.8, num: 14.5 },
    selR: 1.4,
    panelSize: 10,
    panelLh: 12,
    lockS: 7,
    lockW: 8.5,
    lockDx: 6.5,
  },
  /*
   * L'ecran 5:3 du desktop V.4.0 (2026-10-27) : les blocs de 72 x 69.5 (52.5 avant) ; la valeur plus grande et plus bas,
   * l'unite au bas du bloc, le panneau des verrous plus aere. Le reste, celui du dessin haut.
   */
  wide: {
    nameSize: 11.5,
    letterSize: 0,
    unitSize: 10,
    tagAt: 'unit' as 'name' | 'unit',
    tagSize: 10,
    // Un dernier cran a 15, celui du dessin haut : un nom qui y tenait (BLUEPRINT dans SOUND) tient encore
    valueSizes: [30, 26, 22, 18, 15],
    nameDy: 13.5,
    valueDy: 44,
    unitDy: 57.5,
    letters: false,
    notchRow: false,
    tabs: false,
    tabSize: 0,
    foot: 10.5,
    head: { pill: 10, pillH: 14.5, voice: 14.5, sound: 10, bpm: 9.8, num: 14.5 },
    selR: 1.4,
    panelSize: 10,
    panelLh: 13,
    lockS: 7,
    lockW: 8.5,
    lockDx: 6.5,
  },
} as const;
/** right : le bord droit du pattern et du tempo, a gauche de la touche i (R4 ; 312 avant) ; gap : l'air entre le son, le pattern et le tempo (R4 : 8 et 10 avant, la place rendue au son). */
/** Les points de page sous la pastille (2026-10-27, desktop) : leur rayon, l'ecart de leurs centres (unites). */
const PAGE_DOTS = { r: 1.1, gap: 4.4 } as const;
const PAGE_HEAD: { y: number; iconX: number; pillX: number; pillY: number; right: number; rule: number; gap: number } = TALL
  ? { y: 16.5, iconX: 10, pillX: 23, pillY: 4, right: 299, rule: 22.5, gap: 7 }
  : { y: 15.5, iconX: 10, pillX: 23, pillY: 4.5, right: 301, rule: 21.5, gap: 7 };
/**
 * L'en-tete de la vue PAGE a places fixes (2026-10-22, audit SB-13). Les paliers de serrage de ses onglets : le corps
 * (s, de celui des onglets), l'air dans un onglet (pad), entre deux (gap), apres un titre sans cadre (tpad, DELAY de
 * DELAY > GLOBAL) et apres le trait du chevron (chev). headPlan ne compte que jusqu'au palier HEAD_FIT_MAX (90 % du
 * corps), pour les huit voix ; le dernier, 80 %, sert sans voix choisie (revue RB3-4, 2026-10-22, mesure avec SF Pro :
 * FX > VOICE FX > GLOBAL au desktop, 90 % au plus avec une voix ; le telephone reste a 100 %) et a une police de repli
 * plus large. Compter la page sans voix dans headPlan ferait tomber A01 de toutes les pages du desktop (149.0 > 148.5).
 */
const HEAD_FIT = [
  { s: 1, pad: 9, gap: 3, tpad: 9, chev: 5.8 },
  { s: 1, pad: 7, gap: 2, tpad: 4, chev: 3.5 },
  { s: 0.9, pad: 6, gap: 2, tpad: 2, chev: 3 },
  { s: 0.8, pad: 5, gap: 1.5, tpad: 2, chev: 2 },
] as const;
type HeadFit = (typeof HEAD_FIT)[number];
const HEAD_FIT_MAX = 2;
/** Au telephone, le palier jusqu'ou la colonne de la voix recule pour laisser de la place a la zone de MASTER (headPlan). */
const HEAD_FIT_PHONE = 1;
/**
 * La colonne de la voix : l'air entre elle et le pattern (gap), entre elle et la lettre d'un mode arme (badgeAir), et
 * ce que les onglets lui laissent (air ; tabAir sous DIST CHORUS DELAY REVERB, ou la voix est cernee comme un onglet,
 * tabPad l'air dans son cadre).
 */
const HEAD_COL = { gap: 6, badgeAir: 5, air: 5, tabAir: 6.5, tabPad: 2.5 } as const;
/** Un trait de la gauche de l'en-tete (headLeft) : un chevron, un titre ou GLOBAL en retrait, un onglet et sa zone. */
type HeadOp =
  | { kind: 'chev'; x: number; w: number }
  | { kind: 'text'; text: string; x: number; w: number; color: string; align: 'left' | 'center' }
  | { kind: 'tab'; text: string; x: number; w: number; on: boolean; zone: { screen: RytmScreenId; x0: number; x1: number } };
interface HeadLeft {
  label: string;
  pw: number;
  ts: number;
  chev: number;
  ops: HeadOp[];
  end: number;
  heads: string;
}
/** Les paliers de MASTER, TEMPO et du pattern : A01 et le niveau en dB, A01 seul, ni l'un ni l'autre. */
type DialTier = { a01: boolean; full: boolean };
const DIAL_TIERS: readonly DialTier[] = [
  { a01: true, full: true },
  { a01: true, full: false },
  { a01: false, full: false },
];
/** L'air entre le pattern et MASTER (g), entre MASTER et TEMPO (gd). */
const DIAL_GAP = { g: 6, gd: 9 } as const;
/**
 * Les valeurs de reference de la vue PAGE (2026-10-22) : le tempo compte a son plus large (100 a 150) et le niveau en dB
 * aussi, le groupe ne bouge pas quand ils changent ; le pattern a A01 (un pattern plus large, A08, prend 2.5 unites sur
 * les 6 d'air avec la voix, son bord droit ne bouge pas).
 */
const DIAL_REF = { bpm: ['100', '108', '140', '148', '150'], db: '-48.8', slot: 'A01' } as const;
interface HeadPlan {
  tier: DialTier;
  voiceX: number;
  colW: number;
  groupLeft: number;
}
interface DialGeom {
  level: number;
  db: string;
  mNum: string;
  mUnit: string;
  bpmV: number;
  bpm: string;
  tw: number;
  tuw: number;
  meterW: number;
  mnw: number;
  muw: number;
  mFull: number;
  slot: string;
  aw: number;
  width: (t: DialTier) => number;
}
/**
 * Les seize pas du pied (a gauche) et le reste du pied (a droite) ; au
 * telephone (2026-10-09), en bas de l'ecran haut. Revue du meme jour (les
 * deux lignes de l'aide collaient au bas du verre, la seconde a peine
 * lisible) : le pied du telephone va de 132 a 158, ses lignes au milieu ; une
 * ligne a y, deux a y1 et y2 (3.7 d'air entre elles, 5 sous la seconde), les
 * pas centres sur elles.
 */
const PAGE_STRIP: { x0: number; y: number; size: number; pitch: number } = TALL ? { x0: 10, y: UH - 16, size: 6, pitch: 7 } : { x0: 10, y: 105.5, size: 5.5, pitch: 7 };
const PAGE_FOOT: { x0: number; x1: number; y: number; y1: number; y2: number } = TALL
  ? { x0: 132, x1: 312, y: UH - 9.5, y1: UH - 15, y2: UH - 5 }
  : { x0: 132, x1: 312, y: 112.5, y1: 106.8, y2: 114.8 };
/**
 * Le flash d'un pas verrouille qui joue (revue de R2 : un seizieme, 115 ms a
 * 130 BPM, ne se lisait pas) : il tient jusqu'au coup suivant de la voix, au
 * moins min, au plus max (ms).
 */
const FLASH = { min: 280, max: 900 } as const;
/** La valeur d'un bloc haut (VOICE FX, deux rangees) : un corps plus gros (revue du 2026-10-09 : son milieu restait vide). */
const TALL_VALUE = 1.45;
/** SOUND, MIX et COMP sur une seule case au desktop (2026-10-27, la face) : des corps de plus pour la valeur, l'unite a 84 puis 72 %. */
const FACE_TEXT_SIZES: readonly number[] = [13, 11.5, 10, 8.6];
const FACE_UNIT_SHRINK: readonly number[] = [0.84, 0.72];
/** Leur bande au pied du bloc (2026-10-27) : de bh - up a bh - down, sous la ligne d'unite. */
const FACE_STRIP = { up: 9, down: 4 } as const;
/** La largeur des deux plaques de BOTH (layersGlyph), en unites. */
const LAYERS_GLYPH_W = 8.6;
/** Le pied du LOCK au telephone : ses deux aides alternent (ms). */
const TIP_MS = 2400;
/**
 * Le geste qui regle un bloc, dans les aides : DRAG A VALUE depuis le
 * 2026-10-09 (au telephone d'abord, les potards de page ont quitte la face ;
 * au desktop aussi depuis l'etape 2, ses encodeurs sont les FX globaux). TURN
 * A KNOB au desktop depuis V.4.2 (2026-10-27) : l'ecran ne se touche plus
 * (theme.ts SCREEN_TOUCH), le potard sous le bloc le tourne.
 */
const TURN = SCREEN_TOUCH ? 'DRAG A VALUE' : 'TURN A KNOB';
/**
 * Le navigateur des sons (2026-10-18), en unites : rows, le haut et le bas de
 * ses lignes (la place des blocs ; BROWSER_ROWS lignes : 12,5 de haut au
 * desktop, 27 au telephone, assez pour un doigt) ; x0 et x1, leur largeur ;
 * bar, la barre de defilement ; del, le x d'un sample de ce navigateur au
 * bout de sa ligne (desktop ; 0 au telephone : l'appui long) ; arrows, PREV et
 * NEXT dans l'en-tete, a gauche de la touche i (au telephone, sa zone est alors
 * dans le coin du verre) ; les corps : le titre, le rang, le numero, le nom,
 * l'etiquette, l'aide du pied.
 */
const SB: {
  rows: readonly [number, number];
  x0: number;
  x1: number;
  bar: number;
  del: number;
  arrows: readonly [readonly [number, number], readonly [number, number]];
  arrow: number;
  head: number;
  rank: number;
  num: number;
  label: number;
  tag: number;
  hint: [number, number];
} = PORTRAIT
  ? // PREV et NEXT plus larges (2026-10-22, audit RS-11 : 29 x 22 px, leurs zones de 48 px se chevauchaient de 17) : 46 unites,
    // 42 px chacune ; les trois lignes de 36 unites (BROWSER_ROWS), le nom un peu plus gros
    { rows: [24, 132], x0: 8, x1: 305, bar: 312, del: 0, arrows: [[196, 242], [246, 292]], arrow: 6, head: 14.5, rank: 10.5, num: 9.5, label: 14, tag: 9, hint: [10, 10] }
  : TALL
    ? // L'ecran haut du desktop (2026-10-18) : la place des lignes du telephone, sept lignes de 15,4 (BROWSER_ROWS), le x des
      // samples perso garde (la souris), l'en-tete du dessin haut ; l'ecran 5:3 (2026-10-27) : jusqu'a 166, neuf lignes de 15,8
      { rows: [24, 132 + GROW], x0: 8, x1: 305, bar: 312, del: 18, arrows: [[226, 257], [260, 291]], arrow: 5.6, head: 14.5, rank: 10.5, num: 7.5, label: 10.5, tag: 7, hint: [9, 8] }
    : { rows: [24, 99], x0: 8, x1: 306, bar: 312.5, del: 17, arrows: [[255, 277], [280, 302]], arrow: 4.2, head: 11.5, rank: 8, num: 6, label: 8.8, tag: 5.6, hint: [6.8, 5.8] };
/** Une ligne du navigateur. */
const SB_PITCH = (SB.rows[1] - SB.rows[0]) / BROWSER_ROWS;
/** Une ligne du navigateur sous la souris : un fond un peu plus franc que celui d'un bloc (une ligne est plus mince). */
const SB_HOVER = 'rgba(246, 241, 231, 0.09)';

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Le fond d'un bloc sous la souris (desktop, 2026-10-09) : a peine plus clair. */
const HOVER_FILL = 'rgba(246, 241, 231, 0.05)';

/** Le rectangle d'un bloc dans la grille (2026-10-09) : ses cases, et l'air entre elles quand il en couvre plusieurs. */
function cellRect(c: SlotCell): { x: number; y: number; w: number; h: number } {
  const M = MATRIX;
  const w = Math.max(1, c.w);
  const h = Math.max(1, c.h);
  return { x: M.x0 + M.pitch * c.c, y: M.rows[c.r] ?? M.rows[0], w: M.pitch * (w - 1) + M.w, h: (M.rows[1] - M.rows[0]) * (h - 1) + M.h };
}

/** Une frequence courte : 120HZ, 2.1KHZ. */
const hzShort = (f: number): string => (f < 1000 ? `${Math.round(f)}HZ` : `${(f / 1000).toFixed(f < 10000 ? 1 : 0)}KHZ`);

/** La valeur d'un FX global (le popup d'un encodeur) : son nombre, son unite, sa course. */
function globalValueOf(id: EncId): { text: string; unit: string; course: number } {
  const d = id as DialId;
  const [lo, hi] = dialRange(d);
  return { text: dialValueText(d), unit: dialUnit(d), course: hi > lo ? (dialShown(d) - lo) / (hi - lo) : 0 };
}

/**
 * MUTE et SOLO au pied (2026-10-09, la machine a trois etats d'actions.ts) :
 * ONE (une voix attendue), MULTI (et ses voix), ou les voix gardees ; le
 * geste suivant a droite. null : rien a dire.
 */
function modeLines(): { left: string; tip: string; short: string } | null {
  const v = voices.get();
  // Le mode MUTE de FUNC + TRK (V.5.0, le desktop) : global ou du pattern, les voix coupees, comment en sortir
  const dm = DT_FACE ? dtFace.mute() : 'off';
  if (dm === 'global') return { left: `GLOBAL MUTE: ${v.muted.length ? v.muted.join(' ') : 'STEPS 1-8'}`, tip: 'HOLD: SOLO  NO: EXIT', short: 'NO: EXIT' };
  if (dm === 'pattern') {
    const pm = pattern.get().pmutes;
    return { left: `PATTERN MUTE: ${pm.length ? pm.join(' ') : 'STEPS 1-8'}`, tip: 'FUNC + TRK OR NO: EXIT', short: 'NO: EXIT' };
  }
  // short : l'aide quand la liste des voix prend la place (la revue du 2026-10-09 : MULTI MUTE: B. au desktop)
  if (v.soloMode)
    return v.soloMulti
      ? { left: `MULTI SOLO: ${v.solo.length ? v.solo.join(' ') : 'TAP VOICES'}`, tip: 'SOLO: DONE  HOLD: ALL OFF', short: 'HOLD: ALL OFF' }
      : { left: 'SOLO: TAP A VOICE', tip: 'SOLO AGAIN: SEVERAL', short: 'AGAIN: SEVERAL' };
  if (v.muteMode)
    return v.muteMulti
      ? { left: `MULTI MUTE: ${v.muted.length ? v.muted.join(' ') : 'TAP VOICES'}`, tip: 'MUTE: DONE  HOLD: ALL ON', short: 'HOLD: ALL ON' }
      : { left: 'MUTE: TAP A VOICE', tip: 'MUTE AGAIN: SEVERAL', short: 'AGAIN: SEVERAL' };
  if (v.solo.length) return { left: `SOLO: ${v.solo.join(' ')}`, tip: 'HOLD SOLO: ALL OFF', short: 'HOLD: ALL OFF' };
  // MUTE rend toutes les voix d'une tape (2026-10-10) ; au desktop (V.5.0) le mode MUTE de FUNC + TRK les rend une a une
  if (v.muted.length) return DT_FACE ? { left: `MUTED: ${v.muted.join(' ')}`, tip: 'FUNC + TRK: MUTE MODE', short: 'FUNC + TRK' } : { left: `MUTED: ${v.muted.join(' ')}`, tip: 'MUTE: ALL ON', short: 'MUTE: ALL ON' };
  // Le mute du pattern (V.5.0)
  const pm = DT_FACE ? pattern.get().pmutes : [];
  if (pm.length) return { left: `PTN MUTED: ${pm.join(' ')}`, tip: 'FUNC + TRK 2X: PATTERN MUTE', short: 'FUNC + TRK' };
  return null;
}

/**
 * La touche qui ramene l'onglet suivant d'une page (V.5.0, le desktop) : celle de la page, ou pour une page de FUNC la
 * touche qui l'ouvre (MOD sur le MIXER, FUNC + TRIG pour TEMPO, FUNC + FX pour SEND FX).
 */
const FUNC_PAGE_KEY: Readonly<Partial<Record<RytmPageId, string>>> = { mixer: 'MOD', tempo: 'FUNC + TRIG', sendfx: 'FUNC + FX' };
const pageKeyWord = (page: RytmPageId): string => (DT_FACE ? (FUNC_PAGE_KEY[page] ?? pageLabel(page)) : pageLabel(page));

/**
 * L'aide du P-LOCK au pied (la revue de D1, T2) : au desktop hors REC, le P-LOCK demande REC ; les formes, de la plus longue
 * a la plus courte.
 */
function plockHints(): readonly string[] {
  if (!stepWrites()) return [`${TURN}  ·  ● REC + HOLD STEP: P-LOCK`, `${TURN} · ● REC + HOLD STEP: P-LOCK`, '● REC + HOLD STEP: P-LOCK'];
  return [`${TURN}  ·  HOLD A STEP: P-LOCK`, `${TURN} · HOLD A STEP: P-LOCK`, `${TURN} · HOLD STEP: P-LOCK`];
}

/** Le mute du pattern qui joue (V.5.0) : au desktop seulement, le telephone ne le montre pas (la revue de D1, K5). */
const pmutesNow = (): readonly Inst[] => (DT_FACE ? pattern.get().pmutes : []);

/** Coupe a n lettres, un point final quand ca deborde. */
const fit = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}.`);

/** Le son d'une voix : 909, 808, MM ou son sample. */
function soundOf(inst: Inst): string {
  const f = familyOf(inst as ShotId);
  return f ? kit.valueText(f) : 'MM';
}

/** La police : FONT_DISPLAY, en unites (le contexte est a l'echelle). */
const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT_DISPLAY}`;

export class Screen {
  readonly mesh: Mesh;
  /** le reflet du verre, enfant de mesh (glassSheen) */
  private readonly sheen: Mesh;
  readonly texture: CanvasTexture;
  readonly info: ScreenInfo;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timer = 0;
  private unsubs: (() => void)[] = [];
  /**
   * Libere (2026-10-21, audit RS-5) : plus aucun redessin. Avant, un appel tardif (la promesse des polices, resolue
   * apres un demontage) relancait la boucle redessin -> vague au repos -> redessin pour toujours : ce minuteur retenait
   * le Stage mort, et par lui tout l'ancien DOM de la page (environ 1900 noeuds et 270 ecouteurs a chaque remontage).
   */
  private disposed = false;
  /** les coups qui sonnent : l'instant du dernier, par voix */
  private hitAt = new Float64Array(INSTRUMENTS.length);
  private lastStep = -1;
  private blinkUntil = 0;
  private waveFrom = 0;
  private lastCur = -1;
  private activeAt = performance.now();
  private scale: number;
  /** les corps des blocs de la vue PAGE (le telephone : plus gros) */
  private bt: (typeof BLOCK_TYPE)[keyof typeof BLOCK_TYPE];
  /** la palette des dessins (la negative dans un bloc verrouille) */
  private pal: Pal = PAL;
  /** le flash du pas verrouille qui joue (revue de R2) : sa voix, son pas, ses verrous, depuis, jusqu'a */
  private flash: { inst: Inst; step: number; lock: Readonly<StepLock>; from: number; end: number } | null = null;
  /** la tete de lecture vue au dernier dessin (un nouveau pas : un nouveau coup) */
  private flashHead = -1;
  /** INFOS (R4) : allume et l'encodeur dont la carte est montree, au dernier redessin demande */
  private infoKey = '0|-1';

  constructor(
    anisotropy: number,
    /** demande une frame apres un redessin */
    private invalidate: () => void,
    /** telephone : pas de vague au repos (aucune image pour rien) */
    private mobile = false
  ) {
    // L'ecran 5:3 du desktop (2026-10-27) : 1600 x 960, deux fois les 800 x 480 de la dalle de la machine (5 px l'unite)
    const W = mobile ? 1024 : GROW > 0 ? 1600 : 1280;
    const H = Math.round((W * UH) / UW);
    this.scale = W / UW;
    // L'ecran haut du telephone (2026-10-09) a ses corps a lui ; une tablette (mobile, l'ecran du desktop) garde ceux du telephone ;
    // depuis le 2026-10-18 l'ecran du desktop est haut aussi : les corps du dessin haut (1.56 px l'unite a 1440 x 900)
    // L'ecran 5:3 du desktop (2026-10-27, GROW) : les corps de ses blocs plus hauts
    this.bt = TALL && GROW > 0 ? BLOCK_TYPE.wide : TALL ? BLOCK_TYPE.tall : mobile ? BLOCK_TYPE.phone : BLOCK_TYPE.desk;
    this.info = {
      draws: 0,
      text: ['', '', ''],
      lastDrawAt: -Infinity,
      minGapMs: Infinity,
      font: 'vector op-1',
      size: [W, H],
      view: 'home',
      presetList: '',
      presetHead: '',
      page: rytmPage.get().page,
      blocks: [],
      echo: -1,
      lock: -1,
      flash: [],
      strip: '',
      foot: [],
      panel: [],
      footText: '',
      layers: '',
      infos: false,
      infoBlock: -1,
      screen: 'voice',
      cells: [],
      hover: -1,
      popup: '',
      head: '',
      xfade: '',
      lockCount: -1,
      badge: '',
      graph: '',
      tags: [],
      browser: null,
      drop: '',
      menu: [],
      dials: '',
      dialSlot: '',
      headFit: '',
      pageDots: '',
    };
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('screen: no 2d context');
    this.ctx = ctx;
    // Mipmaps et anisotropie : l'ecran est vu de biais et reduit, un simple filtre lineaire scintillerait
    this.texture = makeCanvasTexture(this.canvas, anisotropy);

    const geo = new PlaneGeometry(OLED.w, OLED.d);
    // Couche sur le cadre, rangee 0 du canvas vers l'arriere : les lignes se lisent le long de +x
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'oled';
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = 'oled';
    this.mesh.position.set(OLED.x, OLED.y, OLED.z);
    // Le reflet du verre (2026-10-22, audit, amelioration 20) : il suit l'ecran, le raycast de l'ecran ne le voit pas ;
    // la face V.4.0 du desktop (2026-10-27) : sur tout le verre de 106 x 67, autour de la zone active (le meme centre)
    this.sheen = PORTRAIT ? glassSheen(OLED.w, OLED.d) : glassSheen(OLED.bezel.w, OLED.bezel.d);
    this.mesh.add(this.sheen);
    this.lastCur = patterns.get().cur;
    this.paint(lcd.get(), performance.now());
  }

  /**
   * Abonnements, poses par le Stage une fois tout son GL construit : un
   * constructeur qui echoue plus loin ne laisse ainsi aucun ecouteur qui
   * retiendrait la scene morte.
   */
  listen(): void {
    for (const off of this.unsubs) off();
    const active = (): void => {
      this.activeAt = performance.now();
      this.request();
    };
    this.unsubs = [
      lcd.subscribe(active),
      pattern.subscribe(active),
      // Le TEMPO qui suit les platines (2026-10-27, le SYNC du MIXER) : 124.0 SYNC a la place de 124 BPM
      tempoSync.subscribe(active),
      patterns.subscribe(active),
      editor.subscribe(active),
      voices.subscribe(active),
      // V.5.0 : le mode MUTE de FUNC + TRK et REC se lisent au pied
      dtFace.subscribe(active),
      // FILL (V.5.1) : sa pastille dans l'en-tete
      fill.subscribe(active),
      // CONTROL ALL (V.5.2) : l'en-tete le dit pendant le geste
      ctlAllState.subscribe(active),
      voiceFx.subscribe(active),
      mix.subscribe(active),
      clock.subscribe(active),
      // La vue PAGE (2026-10-08) : sa page, ses valeurs (le kit, les effets du pattern) ; la tete de lecture
      // ne redessine que l'ecran d'aujourd'hui (HOME, EDIT), la page ne la montre pas
      rytmPage.subscribe(active),
      // Le LOCK (2026-10-08) : la pastille, les blocs en negatif, le pied
      rytmLock.subscribe(active),
      // SCENE A et B (2026-10-27) : l'en-tete de la scene armee, ses cles sur les blocs, leurs valeurs
      sceneCtl.subscribe(active),
      pattern.scenes.subscribe(() => active()),
      // Le crossfader (2026-10-27, P2-20) : un redessin doux (xTick) ; le debut et la fin d'un geste (la bande du pied)
      sceneCtl.onX(() => this.xTick()),
      sceneCtl.onGesture(() => this.request()),
      // INFOS (R4) : la touche i pleine, le bloc de la carte montree ; seulement quand l'un des deux change (revue de R4 : le
      // survol d'un pad ou d'un pas redessinait tout l'ecran et le renvoyait a la carte graphique)
      rytmInfos.subscribe(() => {
        const key = `${rytmInfos.isOn() ? 1 : 0}|${this.infoKnob()}|${this.infoDial() ?? ''}`;
        if (key === this.infoKey) return;
        this.infoKey = key;
        this.request();
      }),
      kit.subscribe(() => active()),
      pattern.fx.subscribe(active),
      // La tete de lecture : l'anneau de HOME, les seize pas du pied de la vue PAGE
      playhead.subscribe(() => this.request()),
      focus.subscribe(() => this.request()),
      // Le navigateur des sons (2026-10-18) : son defilement, son curseur, sa fermeture ; la liste des samples (un ajout, un
      // retrait) ; un fichier glisse au-dessus de la machine
      lcdSamples.subscribe(active),
      samplesChanged.subscribe(active),
      // Un sample qui arrive ou qui manque (2026-10-21) : LOADING..., OFFLINE: 909 PLAYS dans SOUND et la liste
      onSampleStatus(active),
      // MASTER et TEMPO (2026-10-19) : celui qu'on survole ou qu'on tient se cerne
      screenDials.subscribe(() => this.request()),
      // La police arrivee apres la premiere image : on redessine. 2026-10-22 (audit SB-01) : onFonts attend les graisses
      // 300 et 400 des valeurs (document.fonts.ready resolvait avant leur arrivee), et se rappelle si elles tardent ; les
      // places fixes de l'en-tete (headPlan) se mesurent de nouveau
      onFonts(() => {
        this.headPlans.clear();
        this.request();
      }),
    ];
    this.request();
  }

  /**
   * Le crossfader bouge (P2-20) : l'ecran se redessine, doucement, seulement s'il montre ce qui en depend (un bloc morphe,
   * la bande du pied) ; l'activite repousse la vague du repos.
   */
  private xLive = false;
  private xTick(): void {
    const now = performance.now();
    this.activeAt = now;
    // Au plus tous les XFADE_UI.screenGapMs, geste ou pas (le MIDI, en phase 3, n'en a pas)
    if (this.xLive) this.request(this.info.lastDrawAt + XFADE_UI.screenGapMs - now);
  }

  /** Un redessin bientot (au plus tous les MIN_GAP_MS ; pendant un geste du crossfader, tous les XFADE_UI.screenGapMs). */
  private request(delay = 0): void {
    if (this.timer !== 0 || this.disposed) return;
    const gap = sceneCtl.moving() ? Math.max(MIN_GAP_MS, XFADE_UI.screenGapMs) : MIN_GAP_MS;
    // Arrondi au-dessus : setTimeout tronque les fractions, l'ecart tombait a 59,5 ms au lieu de 60
    const wait = Math.ceil(Math.max(delay, this.info.lastDrawAt + gap - performance.now(), 0));
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      const now = performance.now();
      const more = this.paint(lcd.get(), now);
      this.invalidate();
      if (more > 0) this.request(more);
      else this.armIdle(now);
    }, wait);
  }

  /**
   * La fin de l'echo d'un bloc (vue PAGE, 2026-10-08) : un redessin a ce
   * moment, par son propre minuteur (comme la vague) ; celui de request()
   * reste libre, un potard qu'on continue de tourner redessine tout de suite.
   */
  private echoTimer = 0;
  /** l'aiguille du COMP est a l'ecran et bouge (2026-10-18) : paintPage redemande une image */
  private meterLive = false;
  private armEcho(ms: number): void {
    window.clearTimeout(this.echoTimer);
    this.echoTimer = 0;
    if (ms <= 0 || this.disposed) return;
    this.echoTimer = window.setTimeout(() => {
      this.echoTimer = 0;
      this.request();
    }, ms);
  }

  /** Desktop, la machine regardee, rien ne bouge : la vague viendra dans IDLE_MS. */
  private idleTimer = 0;
  private armIdle(now: number): void {
    window.clearTimeout(this.idleTimer);
    if (this.mobile || this.disposed) return;
    const left = this.activeAt + IDLE_MS - now;
    this.idleTimer = window.setTimeout(() => this.request(), Math.max(200, left));
  }

  /**
   * La barre de progression telle que dessinee (px de la texture du site,
   * OLED.tex : x0 a x1, y0 a y1), null quand elle n'est pas a l'ecran : le
   * Stage y lit un clic (seekAt).
   */
  bar: { x0: number; x1: number; y0: number; y1: number } | null = null;
  /**
   * Les six onglets de page du pied de la vue PAGE sont-ils a l'ecran
   * (desktop, rien d'autre au pied) ? Le Stage y pose leurs zones (une touche
   * de page chacun, 2026-10-08, revue de R1 : dessines, ils ne faisaient rien).
   */
  tabsShown = false;
  /**
   * Les zones du navigateur des sons dessine (2026-10-18) : l'en-tete (head),
   * PREV et NEXT, le corps de la liste (body, sous les lignes), chaque ligne
   * montree (row-<k>, k depuis la premiere montree) et le x d'un sample de ce
   * navigateur (del-<k>, desktop), sur le verre (u, v de 0 a 1) ; le Stage y
   * pose les zones lcd-sb-* (scene/renderer.ts), a la place de celles des blocs
   * (revue du 2026-10-09 : les zones des blocs restaient vivantes sous la liste
   * de trois lignes, une tape sur un nom tombait sur un bloc cache). [] : ferme.
   */
  browserRects: { id: string; u0: number; u1: number; v0: number; v1: number }[] = [];
  /**
   * Les blocs dessines (2026-10-09) : leur rang et leur rectangle sur le verre
   * (u, v de 0 a 1), ceux qui se reglent (ni case vide ni dessin) ; le Stage y
   * pose les zones lcd-blk-<k> (l'ecran est l'editeur, au desktop aussi).
   */
  blockRects: { k: number; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** Le menu de la voix sous HOME (2026-10-18) : ses touches et leur rectangle, les zones lcd-menu-<id> ; [] ailleurs. */
  menuRects: { id: string; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** MASTER et TEMPO a l'ecran (2026-10-19) : leurs rectangles, les zones lcd-master et lcd-tempo ; [] quand ils n'y sont pas. */
  dialRects: { id: string; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** au telephone, les zones de l'en-tete montent au-dessus du verre (HEAD_HIT_UP, 2026-10-22) */
  private get headUp(): number {
    return this.mobile ? HEAD_HIT_UP : 0;
  }
  /** Les onglets de l'en-tete (VOICE : MAIN SYNTH ; FX : BD FX, GLOBAL) et leur rectangle : les zones lcd-tab-<ecran>. */
  tabSpots: { screen: RytmScreenId; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** Les places fixes de l'en-tete de la vue PAGE par voix et mode arme (headPlan, 2026-10-22), mesurees une fois par police. */
  private headPlans = new Map<string, HeadPlan>();

  /* ---------------- le dessin ---------------- */

  /** Un texte (unites) ; rend sa largeur. spacing : l'air entre les lettres (unites). */
  private text(s: string, x: number, y: number, size: number, color = INK, weight = 500, align: 'left' | 'right' | 'center' = 'left', spacing = 0): number {
    const c = this.ctx;
    c.font = font(weight, size);
    c.fillStyle = color;
    c.textBaseline = 'alphabetic';
    if (spacing <= 0) {
      const w = c.measureText(s).width;
      const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      c.textAlign = 'left';
      c.fillText(s, x0, y);
      return w;
    }
    const widths = [...s].map((ch) => c.measureText(ch).width);
    const w = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, s.length - 1);
    let cx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    c.textAlign = 'left';
    [...s].forEach((ch, i) => {
      c.fillText(ch, cx, y);
      cx += widths[i] + spacing;
    });
    return w;
  }

  /**
   * Une grande valeur a barre (1/8D, 1/16), alignee a gauche (2026-10-22, audit
   * : la barre de 1/8D descendait sur 346 MS dans le bloc TIME du DELAY) : la
   * barre au corps 0.8, posee sur la ligne de base comme une barre de fraction ;
   * jamais plus large que le texte entier (fitValue l'a mesure). Rend sa largeur.
   */
  private slashText(s: string, x: number, y: number, size: number, color: string, weight: number): number {
    const c = this.ctx;
    const parts = s.split('/');
    const ss = size * 0.8;
    c.font = font(weight, ss);
    const lift = Math.max(0, c.measureText('/').actualBoundingBoxDescent || 0);
    let cx = x;
    parts.forEach((part, i) => {
      if (i > 0) cx += this.text('/', cx, y - lift, ss, color, weight);
      if (part) cx += this.text(part, cx, y, size, color, weight);
    });
    return cx - x;
  }

  private textWidth(s: string, size: number, weight = 500, spacing = 0): number {
    this.ctx.font = font(weight, size);
    return this.ctx.measureText(s).width + spacing * Math.max(0, s.length - 1);
  }

  private circle(x: number, y: number, r: number, fill: string | null, stroke: string | null = null, lw = 1.2): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  private pill(x: number, y: number, w: number, h: number, fill: string | null, stroke: string | null = null, lw = 1.2): void {
    const c = this.ctx;
    const r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x + r, y + h);
    c.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  /** Un rectangle aux coins arrondis (le contour du bloc tourne). */
  private roundRect(x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke: string | null = null, lw = 1): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  private line(pts: readonly number[], color: string, lw = 1.4): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }

  /** La place du pas i sur l'anneau (le 1 en haut, dans le sens des aiguilles). */
  private ringAt(i: number, r: number = RING.r): { x: number; y: number; a: number } {
    const a = -Math.PI / 2 + (i / STEP_COUNT) * Math.PI * 2;
    return { x: RING.cx + Math.cos(a) * r, y: RING.cy + Math.sin(a) * r, a };
  }

  /** Redessine ; rend dans combien de ms il faut une autre image (0 : aucune). */
  private paint(s: LcdState, now: number): number {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = BLACK;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const p = pattern.get();
    const ptn = patterns.get();
    const rytmEdit = editor.get() === 'mm808';
    // Ce que montre l'ecran : les presets, EDIT, sinon la vue du MM-RYTM (HOME, ou la page en coup d'oeil)
    const rp = rytmPage.get();
    // Le LOCK (2026-10-08) se montre toujours sur la vue PAGE (HOME n'a pas les blocs)
    const lockStep = rytmEdit ? -1 : rytmLock.get().step;
    // Le navigateur des sons (2026-10-18) : par-dessus HOME et la vue PAGE (EDIT et les presets le ferment)
    const sb = s.keys || rytmEdit ? null : soundBrowserView();
    const view: ScreenInfo['view'] = s.keys ? 'presets' : rytmEdit ? 'edit' : sb ? 'browser' : lockStep >= 0 ? 'page' : rp.view;
    const paged = view === 'page';
    let next = 0;
    if (ptn.cur !== this.lastCur) {
      this.lastCur = ptn.cur;
      this.blinkUntil = now + BLINK_MS;
    }
    this.stepHits(now);
    // La vague du repos (desktop, la machine regardee, rien ne joue ni ne s'affiche ; jamais sur la page)
    const quiet = !clock.running && sc.get().status !== 'playing' && !s.l3 && !s.mix && !sb && !s.keys;
    if (!paged && !this.mobile && quiet && focus.get() === 'mm808' && now - this.activeAt > IDLE_MS) {
      if (this.waveFrom === 0) this.waveFrom = now;
      if (now - this.waveFrom > WAVE_MS) {
        this.waveFrom = 0;
        this.activeAt = now;
      }
    } else this.waveFrom = 0;

    this.bar = null;
    this.tabsShown = false;
    this.browserRects = [];
    this.menuRects = [];
    this.dialRects = [];
    this.info.dials = '';
    this.info.dialSlot = '';
    this.info.headFit = '';
    this.info.pageDots = '';
    this.info.menu = [];
    this.info.browser = null;
    this.info.drop = '';
    this.info.view = view;
    this.info.presetList = '';
    this.info.presetHead = '';
    this.info.page = rp.page;
    this.info.blocks = [];
    this.info.echo = -1;
    this.info.lock = paged || sb ? lockStep : -1;
    this.info.flash = [];
    this.info.strip = '';
    this.info.foot = [];
    this.info.panel = [];
    this.info.footText = '';
    this.info.layers = '';
    this.info.infoBlock = -1;
    this.info.cells = [];
    this.info.graph = '';
    this.info.tags = [];
    this.info.xfade = '';
    this.xLive = false;
    if (!paged) {
      this.blockRects = [];
      this.tabSpots = [];
      this.info.head = '';
      this.info.popup = '';
    }
    // L'ecran haut du telephone (2026-10-09) : le dessin de 120 de HOME, EDIT et des presets, centre (la vue PAGE et le
    // navigateur des sons ont le leur, sur toute la hauteur)
    if (!paged && !sb && DY > 0) c.setTransform(this.scale, 0, 0, this.scale, 0, this.scale * DY);
    if (s.keys) this.paintPresets(s);
    else if (sb) this.paintBrowser(sb, rp, lockStep, now);
    else if (paged) this.armEcho(this.paintPage(s, rp, p.instrument, ptn.cur, now, lockStep));
    else {
      if (rytmEdit) this.paintPatternRing(now);
      else next = Math.max(next, this.paintStepRing(p.instrument, p.steps, now));
      // HOME (2026-10-19) : la lecture, le pattern, MASTER et TEMPO passent dans la bande du haut (paintHomeHead) ; EDIT garde sa ligne
      if (rytmEdit) this.paintHead(ptn.cur, now);
      if (s.mix) this.paintMix(s.mix);
      else if (rytmEdit) this.paintChain();
      else this.paintCards(p.instrument);
      this.paintLine(s, rytmEdit);
    }
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (view === 'home') {
      this.paintHomeHead(ptn.cur, now, s.preset);
      this.paintHomeMenu(p.instrument);
    }
    // Un fichier glisse au-dessus de la machine (2026-10-18) : DROP ON A PAD par-dessus tout, sauf les presets
    const drop = lcdSamples.get().drop;
    if (drop && !s.keys) this.paintDrop(drop);
    // La touche i (R4) : par-dessus tout, sur toutes les vues ; sur l'en-tete negatif du P-LOCK, en negatif aussi
    this.paintInfoKey(rytmInfos.isOn(), (paged || !!sb) && lockStep >= 0 && !drop);
    if (this.blinkUntil > now || (rytmEdit && ptn.next >= 0) || this.waveFrom > 0) next = ANIM_MS;
    // Les coups qui pulsent : sur l'anneau seulement (la page n'en montre rien)
    if (!paged && this.hitAt.some((t) => now - t < PULSE_MS)) next = next || ANIM_MS;
    this.done(s, now);
    return next;
  }

  /** Les coups du pas qui joue : chaque voix qui sonne pulse. */
  private stepHits(now: number): void {
    const st = clock.running ? playhead.get() : -1;
    if (st >= 0 && st !== this.lastStep) {
      const steps = pattern.get().steps;
      INSTRUMENTS.forEach((inst, i) => {
        if (velocity(steps, inst, st) > 0 && voices.plays(inst, pmutesNow())) this.hitAt[i] = now;
      });
    }
    this.lastStep = st;
  }

  /** L'en-tete de la colonne de droite : la lecture, le pattern (il clignote quand il change), le tempo. */
  private paintHead(cur: number, now: number): void {
    const y = 17;
    const x = COL.x0;
    this.runIcon(x, y);
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    const nw = this.text(slotName(cur), x + 14, y, 12, blinkOff ? FAINT : INK, 600, 'left', 0.6);
    // La banque que montre la grille (V.5.2, au desktop) : BANK B a cote du pattern ; la vue BANK le dit en plein
    if (DT_FACE) {
      const word = `BANK ${bankName(patterns.shown())}`;
      const bx = x + 14 + nw + 6;
      const bw = this.textWidth(word, 7, 700, 0.8) + 8;
      if (dtFace.bank()) this.pill(bx, y - 8.5, bw, 10, INK);
      else this.roundRect(bx + 0.5, y - 8, bw - 1, 9, 2.5, null, INK, 0.9);
      this.text(word, bx + bw / 2, y - 1, 7, dtFace.bank() ? BLACK : INK, 700, 'center', 0.8);
      this.info.head = `${dtFace.bank() ? 'BANKS|' : ''}${word}|${slotName(cur)}`;
    }
    // Le tempo : le nombre, BPM a cote en petit (la ligne 1 du texte porte autre chose sur les pages MIX et SAMPLES) ;
    // il suit les platines (2026-10-27, le SYNC du MIXER) : au dixieme, SYNC a la place de BPM
    const bpm = tempoSync.text(pattern.get().bpm);
    // A gauche de la touche i (R4)
    const bw = this.text(tempoSync.unit(), PAGE_HEAD.right, y, 7, HALF, 600, 'right', 0.8);
    this.text(bpm, PAGE_HEAD.right - bw - 4, y, 12, INK, 400, 'right');
  }

  /** La lecture : un triangle ; a l'arret, un carre (x : son bord gauche, y : la ligne de base). */
  private runIcon(x: number, y: number): void {
    const c = this.ctx;
    c.fillStyle = INK;
    if (clock.running) {
      c.beginPath();
      c.moveTo(x, y - 9);
      c.lineTo(x + 8, y - 4.5);
      c.lineTo(x, y);
      c.closePath();
      c.fill();
    } else c.fillRect(x, y - 8.5, 8, 8);
  }

  /** L'anneau des pas de la voix choisie (sans voix : le motif entier en demi-teinte) ; la voix au centre. */
  private paintStepRing(inst: Inst | null, steps: Record<Inst, string>, now: number): number {
    const head = clock.running ? playhead.get() : -1;
    const wave = this.waveFrom > 0 ? (now - this.waveFrom) / 1000 : -1;
    const k = inst ? INSTRUMENTS.indexOf(inst) : -1;
    const pulse = k >= 0 ? Math.max(0, 1 - (now - this.hitAt[k]) / PULSE_MS) : 0;
    // Le cercle du fond, a peine
    this.circle(RING.cx, RING.cy, RING.r, null, FAINT, 0.8);
    for (let i = 0; i < STEP_COUNT; i += 1) {
      let r = RING.r;
      if (wave >= 0) {
        const env = Math.min(1, wave / 1.2, (WAVE_MS / 1000 - wave) / 1.2);
        r += env * 2.4 * Math.sin(wave * 3.4 - i * 0.55);
      }
      const at = this.ringAt(i, r);
      const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
      const bars = VEL_BARS[v];
      if (bars > 0) {
        const rr = [0, 2.6, 3.6, 4.7][bars];
        const on = i === head && pulse > 0 ? rr + 2.2 * pulse : rr;
        this.circle(at.x, at.y, on, inst ? INK : HALF);
      } else this.circle(at.x, at.y, i % 4 === 0 ? 1.5 : 1, i % 4 === 0 ? HALF : FAINT);
      // Un pas qui a des verrous (2026-10-08) : un petit trait dehors
      if (inst && (lockMask(pattern.get().locks, inst) >> i) & 1) {
        // Plus long et plus epais (revue de R2 : 2 a 3 px), un point au bout
        const o0 = this.ringAt(i, r + 5.5);
        const o1 = this.ringAt(i, r + 10.5);
        this.line([o0.x, o0.y, o1.x, o1.y], bars > 0 ? INK : HALF, 1.8);
        this.circle(o1.x, o1.y, 1.3, bars > 0 ? INK : HALF);
      }
      if (i === head) {
        // La tete : un cercle autour du pas, un trait vers le centre
        this.circle(at.x, at.y, 7.2, null, INK, 1.2);
        const a0 = this.ringAt(i, RING.r - 12);
        const a1 = this.ringAt(i, RING.r - 18);
        this.line([a0.x, a0.y, a1.x, a1.y], INK, 1.6);
      }
    }
    // Le centre : la voix en grand, son son (ou MUTE, SOLO) ; sans voix, le pattern
    if (inst) {
      this.text(inst, RING.cx, RING.cy + 7, inst.length > 2 ? 21 : 25, INK, 300, 'center');
      const solo = voices.isSolo(inst);
      const muted = !voices.plays(inst, pmutesNow());
      if (solo || muted) {
        const word = solo ? 'SOLO' : 'MUTE';
        const w = this.textWidth(word, 7, 700, 0.8) + 8;
        this.pill(RING.cx - w / 2, RING.cy + 13, w, 10, INK);
        this.text(word, RING.cx, RING.cy + 20.5, 7, BLACK, 700, 'center', 0.8);
      } else this.text(fit(soundOf(inst), 10), RING.cx, RING.cy + 21, 8, HALF, 600, 'center', 0.6);
    } else {
      this.text('ALL', RING.cx, RING.cy + 6, 18, HALF, 300, 'center', 1);
      this.text('PICK A VOICE', RING.cx, RING.cy + 19, 6, FAINT_TEXT, 600, 'center', 0.5);
    }
    return 0;
  }

  /** Sans voix choisie : le plus fort des coups du pas. */
  private maxVel(steps: Record<Inst, string>, i: number): number {
    let best = 0;
    for (const k of INSTRUMENTS) best = Math.max(best, velocity(steps, k, i));
    return best;
  }

  /**
   * EDIT : l'anneau des seize patterns de la banque montree (V.5.2 ; le courant plein, la chaine reliee, celui qui attend
   * clignote). La vue BANK (FUNC + PTN) : les huit banques sur les pas 1 a 8.
   */
  private paintPatternRing(now: number): void {
    const p = patterns.get();
    const blinkOn = Math.floor(now / 160) % 2 === 0;
    this.circle(RING.cx, RING.cy, RING.r, null, FAINT, 0.8);
    if (DT_FACE && dtFace.bank()) {
      this.paintBankRing(blinkOn);
      return;
    }
    const b0 = patterns.shown() * BANK_SIZE;
    const local = (i: number): number => (i >= b0 && i < b0 + BANK_SIZE ? i - b0 : -1);
    // La chaine : un arc d'un pattern au suivant (les deux dans la banque montree)
    if (p.chain.length > 1) {
      const c = this.ctx;
      c.strokeStyle = HALF;
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      for (let k = 0; k + 1 < p.chain.length; k += 1) {
        const ia = local(p.chain[k]);
        const ib = local(p.chain[k + 1]);
        if (ia < 0 || ib < 0) continue;
        const a = this.ringAt(ia);
        const b = this.ringAt(ib);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.quadraticCurveTo(RING.cx, RING.cy, b.x, b.y);
        c.stroke();
      }
    }
    for (let i = 0; i < BANK_SIZE; i += 1) {
      const at = this.ringAt(i);
      const slot = b0 + i;
      const inChain = p.chain.length > 1 && p.chain.includes(slot);
      if (slot === p.cur) {
        this.circle(at.x, at.y, 5.4, INK);
        if (inChain && p.chain[p.pos] === slot) this.circle(at.x, at.y, 8.2, null, INK, 1);
      } else if (slot === p.next) this.circle(at.x, at.y, 4.6, blinkOn ? INK : null, INK, 1.2);
      else if (patterns.filled(slot)) this.circle(at.x, at.y, 3.6, inChain ? INK : HALF);
      else this.circle(at.x, at.y, 1.4, FAINT);
      // Le numero, dehors, sur les temps (1 5 9 13)
      if (i % 4 === 0) {
        const o = this.ringAt(i, RING.r - 11);
        this.text(String(i + 1), o.x, o.y + 2.6, 7, HALF, 600, 'center');
      }
    }
    this.text(slotName(p.cur), RING.cx, RING.cy + 6, 19, INK, 300, 'center', 0.5);
    // V.5.0 au desktop : la touche s'appelle PTN
    const word = DT_FACE ? 'PTN' : 'EDIT';
    const w = this.textWidth(word, 7, 700, 0.8) + 8;
    this.pill(RING.cx - w / 2, RING.cy + 12, w, 10, INK);
    this.text(word, RING.cx, RING.cy + 19.5, 7, BLACK, 700, 'center', 0.8);
  }

  /** La vue BANK (V.5.2) : les banques A a H sur les pas 1 a 8, celle qui joue pleine, l'affichee clignote, une vide a peine. */
  private paintBankRing(blinkOn: boolean): void {
    const p = patterns.get();
    const playing = bankOf(p.cur);
    for (let b = 0; b < BANKS; b += 1) {
      const at = this.ringAt(b);
      if (b === playing) this.circle(at.x, at.y, 5.4, INK);
      else if (b === p.bank) this.circle(at.x, at.y, 4.6, blinkOn ? INK : null, INK, 1.2);
      else if (patterns.bankFilled(b)) this.circle(at.x, at.y, 3.6, HALF);
      else this.circle(at.x, at.y, 1.4, FAINT);
      const o = this.ringAt(b, RING.r - 11);
      this.text(bankName(b), o.x, o.y + 2.6, 7, b === p.bank ? INK : HALF, 700, 'center');
    }
    this.text(`BANK ${bankName(p.bank)}`, RING.cx, RING.cy + 6, 15, INK, 300, 'center', 0.5);
    const w = this.textWidth('BANK', 7, 700, 0.8) + 8;
    this.pill(RING.cx - w / 2, RING.cy + 12, w, 10, INK);
    this.text('BANK', RING.cx, RING.cy + 19.5, 7, BLACK, 700, 'center', 0.8);
  }

  /** EDIT, la colonne de droite : la chaine en grand, ce qui attend, l'aide. */
  private paintChain(): void {
    const p = patterns.get();
    const x = COL.x0;
    this.text('CHAIN', x, 42, 8, HALF, 700, 'left', 1);
    const chain = p.chain.length > 1 ? p.chain.map((k) => slotName(k)).join('  ') : slotName(p.cur);
    this.text(fit(chain, 22), x, 62, 13, INK, 400);
    if (p.next >= 0) this.text(`NEXT ${slotName(p.next)}`, x, 82, 9, INK, 600, 'left', 0.8);
  }

  /* ---------------- les trois reglages, facon OP-1 ---------------- */

  /** Les trois reglages de la voix (VOLUME, TONE, DECAY) ou de la machine (SWING, STRETCH, MASTER). */
  private paintCards(inst: Inst | null): void {
    // Les valeurs de 0 a 127 depuis le 2026-10-08 (Mika : "de 0 a 127"), celles des blocs de la vue PAGE et du MIDI
    const fx = inst ? voiceFx.of(inst) : null;
    const cards: { label: string; text: string; draw: (r: Rect) => void }[] = fx
      ? [
          { label: 'VOLUME', text: v127Text(fx.level), draw: (r) => this.drawLevel(r, fx.level) },
          { label: 'TONE', text: v127Text((fx.tone + 1) / 2, true), draw: (r) => this.drawTone(r, fx.tone) },
          { label: 'DECAY', text: v127Text(fx.decay), draw: (r) => this.drawDecay(r, fx.decay) },
        ]
      : [
          { label: 'SWING', text: v127Text(mix.swing), draw: (r) => this.drawSwing(r, mix.swing) },
          { label: 'STRETCH', text: v127Text((mix.stretch + 1) / 2, true), draw: (r) => this.drawStretch(r, mix.stretch) },
          { label: 'MASTER', text: v127Text(mix.level), draw: (r) => this.drawLevel(r, mix.level) },
        ];
    const w = (COL.x1 - COL.x0 - CARD.gap * (cards.length - 1)) / cards.length;
    cards.forEach((card, i) => {
      const x0 = COL.x0 + i * (w + CARD.gap);
      card.draw({ x0, y0: CARD.y0, x1: x0 + w, y1: CARD.y1 });
      this.text(card.label, x0, CARD.label, 7, HALF, 700, 'left', 0.9);
      this.text(card.text, x0, CARD.value, 13, INK, 400);
    });
  }

  /*
   * Les images prennent leur zone (2026-10-08) : la carte de HOME (CARD_W de
   * large, 34 de haut) ou l'image d'un bloc de la vue PAGE (22 x 14). A la
   * taille d'une carte, tout reste comme avant (k = 1) ; plus petites, les
   * ecarts, les points et les traits se resserrent.
   */

  /** L'echelle d'une image par rapport a une carte de HOME (1 a sa taille, jamais plus). */
  private static cardK(r: Rect): number {
    return Math.min(1, (r.x1 - r.x0) / CARD_W);
  }

  /** VOLUME, MASTER : des barres qui montent, allumees jusqu'a la valeur. */
  private drawLevel(r: Rect, v: number): void {
    const n = 7;
    const gap = 2.4 * Screen.cardK(r);
    const bw = (r.x1 - r.x0 - gap * (n - 1)) / n;
    const lit = Math.max(0, Math.min(1, v)) * n;
    const base = Math.min(6, 0.3 * (r.y1 - r.y0));
    for (let k = 0; k < n; k += 1) {
      const h = base + ((r.y1 - r.y0 - base) * (k + 1)) / n;
      const x = r.x0 + k * (bw + gap);
      const on = k + 1 <= lit + 1e-6 ? this.pal.ink : k < lit ? this.pal.half : this.pal.faint;
      this.ctx.fillStyle = on;
      this.ctx.fillRect(x, r.y1 - h, bw, h);
    }
  }

  /** TONE, STRETCH : une courbe de filtre qui bascule (a gauche plus sombre, a droite plus brillant). */
  private drawTone(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const mid = (r.y0 + r.y1) / 2;
    const amp = (r.y1 - r.y0) / 2 - 2;
    const pts: number[] = [];
    const n = 28;
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const s = 1 / (1 + Math.exp(-(t - 0.5) * 9));
      pts.push(x0 + (x1 - x0) * t, mid - v * amp * (2 * s - 1));
    }
    this.line([x0, mid, x1, mid], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
  }

  /** DECAY : une enveloppe, l'attaque puis la queue, plus longue avec la valeur. */
  private drawDecay(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const base = r.y1;
    const top = r.y0 + 2;
    const ax = x0 + 3 * Math.max(0.5, Screen.cardK(r));
    const tau = 0.08 + 0.6 * Math.max(0, Math.min(1, v));
    const pts: number[] = [x0, base, ax, top];
    const n = 30;
    for (let k = 1; k <= n; k += 1) {
      const t = k / n;
      pts.push(ax + (x1 - ax) * t, base - (base - top) * Math.exp(-t / tau));
    }
    this.line([x0, base, x1, base], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
  }

  /** SWING : quatre paires de points, la seconde de chaque paire decalee par le swing. */
  private drawSwing(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const n = 4;
    const cell = (x1 - x0) / n;
    const y = (r.y0 + r.y1) / 2;
    const ks = Screen.cardK(r);
    this.line([x0, y, x1, y], this.pal.faint, 0.8);
    for (let k = 0; k < n; k += 1) {
      const xa = x0 + k * cell + cell * 0.18;
      const xb = x0 + k * cell + cell * (0.5 + 0.32 * Math.max(0, Math.min(1, v)));
      this.circle(xa, y, 3.4 * ks, this.pal.ink);
      this.circle(xb, y, 2.6 * ks, this.pal.half);
    }
  }

  /** STRETCH : une onde dont la longueur s'etire ou se resserre. */
  private drawStretch(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const mid = (r.y0 + r.y1) / 2;
    const amp = (r.y1 - r.y0) / 2 - 3;
    const cycles = 3 * Math.pow(2, -Math.max(-1, Math.min(1, v)));
    const pts: number[] = [];
    const n = 48;
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      pts.push(x0 + (x1 - x0) * t, mid - amp * Math.sin(t * cycles * Math.PI * 2) * Math.exp(-t * 1.6));
    }
    this.line([x0, mid, x1, mid], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
  }

  /**
   * COND (V.5.1) : A:B, une case par passage du cycle, celle qui joue pleine (!A:B : les autres pleines) ; les autres
   * conditions, une ligne et un point (NONE : la ligne seule ; FILL, PRE, NEI, 1ST, LST : la valeur les dit en toutes lettres).
   */
  private drawCond(r: Rect, i: number): void {
    const c = CONDS[Math.max(0, Math.min(CONDS.length - 1, i))];
    const y = (r.y0 + r.y1) / 2;
    if (c.kind !== 'ab') {
      this.line([r.x0, y, r.x1, y], this.pal.faint, 1.2);
      if (c.kind !== 'none') this.circle(r.x0 + (r.x1 - r.x0) / 2, y, 2.2, c.not ? this.pal.half : this.pal.ink);
      return;
    }
    const gap = 1.6;
    const w = Math.min(7, (r.x1 - r.x0 - gap * (c.b - 1)) / c.b);
    const h = Math.min(r.y1 - r.y0 - 2, w + 2);
    const x0 = r.x0 + (r.x1 - r.x0 - (w * c.b + gap * (c.b - 1))) / 2;
    for (let k = 0; k < c.b; k += 1) {
      const on = (k === c.a - 1) !== c.not;
      const x = x0 + k * (w + gap);
      if (on) this.roundRect(x, y - h / 2, w, h, 1, this.pal.ink);
      else this.roundRect(x + 0.4, y - h / 2 + 0.4, w - 0.8, h - 0.8, 1, null, this.pal.half, 0.8);
    }
  }

  /** RATE (V.5.1) : les repetitions d'un temps (quatre pas), un trait chacune, les pas reperes a peine. */
  private drawRate(r: Rect, i: number): void {
    const den = RATE_DENS[Math.max(0, Math.min(RATE_DENS.length - 1, i))];
    const span = r.x1 - r.x0;
    const base = r.y1;
    const top = r.y0 + 2;
    this.line([r.x0, base, r.x1, base], this.pal.faint, 0.8);
    for (let k = 1; k < 4; k += 1) this.line([r.x0 + (span * k) / 4, base, r.x0 + (span * k) / 4, base - 2], this.pal.faint, 0.6);
    // Un temps = quatre pas : den / 4 repetitions (1/1 : une par mesure, un seul trait au debut)
    const n = Math.max(1, Math.min(24, Math.round(den / 4)));
    for (let k = 0; k < n; k += 1) {
      const x = r.x0 + (span * k) / n + 0.6;
      this.line([x, base, x, top], k === 0 ? this.pal.ink : this.pal.half, k === 0 ? 1.6 : 1.1);
    }
  }

  /** VFAD (V.5.1) : six repetitions, leur hauteur menee par VFAD (elle descend, monte, ou reste). */
  private drawVfad(r: Rect, v: number): void {
    const n = 6;
    const gap = 2;
    const bw = (r.x1 - r.x0 - gap * (n - 1)) / n;
    for (let k = 0; k < n; k += 1) {
      const g = rtrgGain(1, v, k / (n - 1));
      const h = Math.max(1.2, (r.y1 - r.y0 - 1) * g);
      this.ctx.fillStyle = k === 0 ? this.pal.ink : this.pal.half;
      this.ctx.fillRect(r.x0 + k * (bw + gap), r.y1 - h, bw, h);
    }
  }

  /** WAVE (V.5.1) : la forme du LFO sur un cycle et demi, son zero a peine (EXP et RMP partent du bas : unipolaires). */
  private drawWave(r: Rect, i: number): void {
    const w = LFO_WAVES[Math.max(0, Math.min(LFO_WAVES.length - 1, i))];
    const mid = (r.y0 + r.y1) / 2;
    const amp = (r.y1 - r.y0) / 2 - 1.5;
    const uni = w === 'EXP' || w === 'RMP';
    const pts: number[] = [];
    const n = 54;
    for (let k = 0; k <= n; k += 1) {
      const u = (k / n) * 1.5;
      const val = waveAt(w, Math.min(u, 1.4999), 7);
      pts.push(r.x0 + (r.x1 - r.x0) * (k / n), uni ? r.y1 - 1.5 - val * 2 * amp : mid - val * amp);
    }
    this.line([r.x0, uni ? r.y1 - 1.5 : mid, r.x1, uni ? r.y1 - 1.5 : mid], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
  }

  /** Des crans (SOUND, GATE) : un point par cran, le choisi en grand ; plus de 12 : une barre. */
  private drawNotch(r: Rect, n: number, course: number): void {
    if (n < 2 || n > 12) {
      this.drawBar(r, course, false);
      return;
    }
    const y = (r.y0 + r.y1) / 2;
    const cur = Math.round(clamp01(course) * (n - 1));
    const step = (r.x1 - r.x0) / (n - 1);
    for (let i = 0; i < n; i += 1) {
      const x = r.x0 + i * step;
      if (i === cur) this.circle(x, y, n > 6 ? 1.7 : 2.3, this.pal.ink);
      else this.circle(x, y, 0.8, this.pal.half);
    }
  }

  /** Une barre : le trait a peine, la valeur pleine et son point ; centre : depuis le milieu (son repere). */
  private drawBar(r: Rect, course: number, centre: boolean): void {
    const y = (r.y0 + r.y1) / 2;
    const x = r.x0 + (r.x1 - r.x0) * clamp01(course);
    const from = centre ? (r.x0 + r.x1) / 2 : r.x0;
    this.line([r.x0, y, r.x1, y], this.pal.faint, 1.4);
    if (centre) this.line([from, y - 2.4, from, y + 2.4], this.pal.half, 0.8);
    this.line([from, y, x, y], this.pal.ink, 1.8);
    this.circle(x, y, 2, this.pal.ink);
  }

  /**
   * START (2026-10-08) : une onde qui s'eteint, le repere du debut ; ce qui
   * est avant lui (saute) a peine.
   */
  private drawStart(r: Rect, course: number): void {
    const { x0, x1 } = r;
    const mid = (r.y0 + r.y1) / 2;
    const amp = (r.y1 - r.y0) / 2 - 1;
    const cut = x0 + (x1 - x0) * clamp01(course) * 0.9;
    const n = 40;
    const before: number[] = [];
    const after: number[] = [];
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const y = mid - amp * Math.sin(t * 5.5 * Math.PI * 2) * Math.exp(-t * 2.6);
      if (x <= cut) before.push(x, y);
      if (x >= cut - (x1 - x0) / n) after.push(x, y);
    }
    if (before.length >= 4) this.line(before, this.pal.faint, 1.2);
    if (after.length >= 4) this.line(after, this.pal.ink, 1.4 * Math.max(0.7, Screen.cardK(r)));
    this.line([cut, r.y0, cut, r.y1], this.pal.ink, 1.2);
  }

  /* ---------------- les pages ---------------- */

  /** Page MIX : les volumes de la rangee en faders (la voix reglee pleine). */
  private paintMix(m: NonNullable<LcdState['mix']>): void {
    const n = m.insts.length;
    const w = (COL.x1 - COL.x0) / n;
    const y0 = 30;
    const y1 = 82;
    m.insts.forEach((inst, k) => {
      const cx = COL.x0 + w * (k + 0.5);
      const v = Math.max(0, Math.min(1, m.levels[k] ?? 0));
      const sel = inst === m.sel;
      this.line([cx, y0, cx, y1], FAINT, 1.4);
      const y = y1 - (y1 - y0) * v;
      this.line([cx, y1, cx, y], sel ? INK : HALF, 2.4);
      this.circle(cx, y, sel ? 4.6 : 3.4, sel ? INK : HALF);
      this.text(inst, cx, 96, 8, sel ? INK : HALF, 700, 'center', 0.6);
      this.text(String(Math.round(v * 100)), cx, 26, 7, sel ? INK : FAINT_TEXT, 600, 'center');
    });
  }

  /* ---------------- le navigateur des sons (2026-10-18) ---------------- */

  /**
   * Le navigateur des sons, sur tout l'ecran : l'en-tete (la voix et SOUND ; en
   * P-LOCK, l'en-tete en negatif et le pas que la liste verrouille), le rang
   * (7 / 24), PREV et NEXT en deux fleches ; les lignes montrees (un numero, le
   * nom ; a droite SYNTH pour une machine, USER pour un sample de ce
   * navigateur et, au desktop, son x) : le son du moment en pastille pleine,
   * la ligne du clavier cernee, une ligne armee (REMOVE ?) en contour ; la
   * barre de defilement ; le pied (les seize pas, le message ou l'aide). Les
   * zones (browserRects) suivent ce qui est dessine.
   */
  private paintBrowser(v: SoundBrowserView, rp: RytmPageState, lockStep: number, now: number): void {
    const H = PAGE_HEAD;
    const neg = v.lock >= 0;
    const ink = neg ? BLACK : INK;
    const half = neg ? 'rgba(0, 0, 0, 0.62)' : HALF;
    const faint = neg ? 'rgba(0, 0, 0, 0.32)' : FAINT;
    const rects = this.browserRects;
    const push = (id: string, x: number, y: number, w: number, h: number): void => {
      rects.push({ id, ...this.spot({ x, y, w, h }) });
    };
    // L'en-tete : le titre a gauche (en P-LOCK, le cadenas et le pas devant), le rang, PREV et NEXT a gauche de la touche i
    if (neg) {
      this.ctx.fillStyle = INK;
      this.ctx.fillRect(0, 0, UW, H.rule + 0.6);
    }
    let x = 10;
    if (neg) {
      const gs = SB.head * 0.62;
      this.padlock(x - 1, H.y, gs, BLACK);
      x += gs + 3;
      x += this.text(`STEP ${two(v.lock + 1)}`, x, H.y, SB.head * 0.78, BLACK, 800, 'left', 0.7) + 7;
    }
    const [prev, next] = SB.arrows;
    const rankW = this.text(v.rank, prev[0] - 6, H.y, SB.rank, ink, 600, 'right', 0.4);
    const title = this.fitText(v.title, Math.max(20, prev[0] - 6 - rankW - 8 - x), SB.head, 0.6, 700);
    this.text(title, x, H.y, SB.head, ink, 700, 'left', 0.6);
    push('lcd-sb-head', 0, 0, prev[0] - 1, H.rule);
    const arrow = (box: readonly [number, number], up: boolean, on: boolean): void => {
      const w = box[1] - box[0];
      const cx = box[0] + w / 2;
      const cy = H.rule / 2 + 0.5;
      this.roundRect(box[0] + 0.5, 2.5, w - 1, H.rule - 4.5, 3, null, on ? half : faint, 0.9);
      const a = SB.arrow;
      const c = this.ctx;
      c.beginPath();
      c.moveTo(cx - a, up ? cy + a * 0.55 : cy - a * 0.55);
      c.lineTo(cx + a, up ? cy + a * 0.55 : cy - a * 0.55);
      c.lineTo(cx, up ? cy - a * 0.65 : cy + a * 0.65);
      c.closePath();
      c.fillStyle = on ? ink : faint;
      c.fill();
    };
    arrow(prev, true, v.cur > 0);
    arrow(next, false, v.cur < v.n - 1);
    // Au telephone, au-dessus du verre aussi (HEAD_HIT_UP, 2026-10-22, audit RS-11), et jusqu'au milieu de l'air entre elles
    const up = this.headUp;
    const gap = (next[0] - prev[1]) / 2;
    push('lcd-sb-prev', prev[0], -up, prev[1] - prev[0] + gap, H.rule + up);
    push('lcd-sb-next', next[0] - gap, -up, next[1] - next[0] + gap, H.rule + up);
    if (!neg) this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
    // Les lignes
    const [y0, y1] = SB.rows;
    push('lcd-sb-body', 0, y0, UW, y1 - y0);
    const scroll = v.rows.length > v.visible;
    const x0 = SB.x0;
    const x1 = SB.x1 - (scroll ? 3 : 0);
    const pad = TALL ? 2.2 : 0.9;
    const rr = TALL ? 4 : 2.6;
    const numW = this.textWidth('88', SB.num, 600, 0.3);
    const keyed = lcdSamples.get().cursor >= 0;
    const hover = lcdSamples.get().hover;
    const drawn: string[] = [];
    for (let k = 0; k < v.visible; k += 1) {
      const i = v.top + k;
      const r = v.rows[i];
      if (!r) break;
      const y = y0 + k * SB_PITCH;
      const cy = y + SB_PITCH / 2;
      const cur = i === v.cur && r.kind !== 'load';
      const armed = i === v.arm;
      const cursor = keyed && i === v.cursor;
      const full = cur && !armed;
      // Sous la souris (desktop) : un fond a peine plus clair, comme un bloc survole
      if (k === hover && !full && !armed) this.roundRect(x0, y + pad, x1 - x0, SB_PITCH - 2 * pad, rr, SB_HOVER);
      if (full) this.roundRect(x0, y + pad, x1 - x0, SB_PITCH - 2 * pad, rr, INK);
      if (armed) this.roundRect(x0 + 0.5, y + pad + 0.5, x1 - x0 - 1, SB_PITCH - 2 * pad - 1, rr, null, INK, TALL ? 1.6 : 1.2);
      // La ligne du clavier : un cadre a la place de la pastille (sur la pastille du son du moment, en noir, juste dedans)
      if (cursor && !armed) {
        const ins = full ? (TALL ? 2.2 : 1.3) : 0.5;
        this.roundRect(x0 + ins, y + pad + ins, x1 - x0 - 2 * ins, SB_PITCH - 2 * pad - 2 * ins, Math.max(1, rr - ins), null, full ? BLACK : INK, TALL ? 1.4 : 0.9);
      }
      const fg = full ? BLACK : r.kind === 'load' ? HALF : INK;
      const sub = full ? 'rgba(0, 0, 0, 0.55)' : HALF;
      const by = (size: number): number => cy + size * 0.36;
      let lx = x0 + 5;
      if (r.kind !== 'load') this.text(two(i + 1), lx, by(SB.num), SB.num, full ? sub : FAINT_TEXT, 600, 'left', 0.3);
      lx += numW + (TALL ? 7 : 5);
      let rx = x1 - (TALL ? 7 : 4);
      if (armed) {
        // REMOVE ? : la ligne attend son second geste (une tape, un clic, Suppr)
        const again = this.mobile ? 'TAP AGAIN' : 'AGAIN';
        rx -= this.text(again, rx, by(SB.tag), SB.tag, INK, 700, 'right', 0.6) + 6;
        this.text(this.fitText(`REMOVE ${r.label}?`, rx - lx, SB.label, 0.4, 700), lx, by(SB.label), SB.label, INK, 700, 'left', 0.4);
      } else {
        // Le x d'un sample de ce navigateur (desktop) : sa zone, au bout de la ligne
        if (r.user && SB.del > 0) {
          const dx = x1 - SB.del / 2;
          const a = SB.label * 0.26;
          const col = full ? BLACK : HALF;
          this.line([dx - a, cy - a, dx + a, cy + a], col, 1.1);
          this.line([dx - a, cy + a, dx + a, cy - a], col, 1.1);
          push(`lcd-sb-del-${k}`, x1 - SB.del, y, SB.del, SB_PITCH);
          rx = x1 - SB.del - 2;
        }
        if (r.tag) rx -= this.text(r.tag, rx, by(SB.tag), SB.tag, sub, 700, 'right', 0.7) + 6;
        const name = this.fitText(r.label, Math.max(10, rx - lx), SB.label, 0.4, full ? 700 : 500);
        this.text(name, lx, by(SB.label), SB.label, fg, full ? 700 : 500, 'left', 0.4);
      }
      push(`lcd-sb-row-${k}`, 2, y, (r.user && SB.del > 0 && !armed ? x1 - SB.del : SB.x1 + 2) - 2, SB_PITCH);
      drawn.push(`${r.label}${cur ? '*' : ''}${cursor ? '>' : ''}${armed ? '!' : ''}${r.user ? 'u' : ''}`);
    }
    // La barre de defilement : la part montree de la liste, a sa place
    if (scroll) {
      const h = y1 - y0 - 2;
      const len = v.rows.length;
      const t0 = y0 + 1 + (h * v.top) / len;
      const t1 = t0 + Math.max(4, (h * v.visible) / len);
      this.line([SB.bar, y0 + 1, SB.bar, y1 - 1], FAINT, 1);
      this.line([SB.bar, t0, SB.bar, Math.min(y1 - 1, t1)], INK, TALL ? 2.6 : 1.8);
    }
    // Le pied : les seize pas (le pas du P-LOCK cerne), le message du moment ou l'aide
    this.paintStrip(v.inst, rp.sel, lockStep);
    const F = PAGE_FOOT;
    const msg = lcdMessage.get(now);
    // L'ecran intouchable du desktop (V.4.2) : le potard de SOUND choisit (la liste le suit), Suppr retire un son a soi
    const help = !SCREEN_TOUCH
      ? [neg ? 'TURN SOUND: P-LOCK THIS STEP' : 'TURN SOUND: CHOOSE · DEL: REMOVE', 'DROP A FILE ON THE MACHINE · ESC']
      : this.mobile
        ? ['TAP: CHOOSE · DRAG: SCROLL', neg ? 'TAP: P-LOCK THIS STEP' : 'HOLD YOURS: REMOVE']
        : ['CLICK: CHOOSE · WHEEL: SCROLL', neg ? 'CLICK: P-LOCK THIS STEP · ESC' : PORTRAIT ? 'DROP A FILE ON A PAD · ESC' : 'DROP A FILE HERE · ESC'];
    const l1 = msg ? msg.text : help[0];
    const l2 = msg ? help[0] : help[1];
    const t1 = this.fitText(l1, F.x1 - F.x0, SB.hint[0], 0.5, 600);
    const t2 = this.fitText(l2, F.x1 - F.x0, SB.hint[1], 0.6, 700);
    this.text(t1, F.x0, F.y1, SB.hint[0], msg ? INK : HALF, 600, 'left', 0.5);
    this.text(t2, F.x0, F.y2, SB.hint[1], HALF, 700, 'left', 0.6);
    this.info.footText = `${t1} / ${t2}`;
    this.info.browser = { title: v.title, rank: v.rank, top: v.top, cur: v.cur, cursor: v.cursor, rows: drawn };
  }

  /** Un fichier glisse au-dessus de la machine (2026-10-18) : ou il ira, en grand, dans un cadre en pointilles. */
  private paintDrop(target: Inst | 'pad'): void {
    const c = this.ctx;
    c.fillStyle = BLACK;
    c.fillRect(0, 0, UW, UH);
    c.save();
    c.setLineDash([5, 3.5]);
    this.roundRect(6, 6, UW - 12, UH - 12, 6, null, INK, TALL ? 1.6 : 1.3);
    c.restore();
    const inst = pattern.get().instrument;
    // La face V.4.0 du desktop (2026-10-27) : plus de pads, le fichier lache n'importe ou sur la machine va a la voix
    // choisie (DROP FOR BD), sans voix il attend qu'on en choisisse une (au clavier, A S D F et Z X C V)
    const desk = !PORTRAIT && target === 'pad';
    const big = desk ? (inst ? `DROP FOR ${inst}` : 'PICK A VOICE FIRST') : target === 'pad' ? 'DROP ON A PAD' : `DROP ON ${target}`;
    const sub = desk
      ? inst
        ? 'WAV AIFF MP3 FLAC M4A · 10 MB'
        : 'KEYS A S D F · Z X C V'
      : target === 'pad'
        ? inst
          ? `OR HERE: ${inst} SOUND`
          : 'ITS VOICE TAKES THE FILE'
        : 'WAV AIFF MP3 FLAC M4A · 10 MB';
    const mid = UH / 2;
    this.text(big, UW / 2, mid + (TALL ? 2 : 1), TALL ? 27 : 21, INK, 300, 'center', 0.5);
    this.text(sub, UW / 2, mid + (TALL ? 24 : 17), TALL ? 10 : 7, HALF, 700, 'center', 0.8);
    this.info.drop = big;
  }

  /**
   * Le mode presets (2026-10-27, la V.4.2, Mika : "la gestion doit etre plus simple") sur toute la hauteur de l'ecran :
   * le titre (LOADED, EDITED, FACTORY, la note) et le rang ; la liste autour du curseur, la ligne d'avant et d'apres a
   * peine, le curseur en grand entre ses chevrons (une etoile : le preset charge a bouge) ; OVERWRITE / AS NEW et
   * DELETE? disent leur question dessous ; le nom en cours (USER/NAME, les cases vides de l'utilisateur soulignees, le
   * curseur du potard B sous sa lettre) ; les cinq touches en pastilles, au desktop juste au-dessus des touches de la
   * face qui les font (rytm/presetKeys.ts). L'aide du desktop nomme les potards (A: BROWSE ; A: LETTER  B: CURSOR).
   */
  private paintPresets(s: LcdState): void {
    const v = s.presets;
    if (!v) return;
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const L = PRESET_LAYOUT;
    const desk = !this.mobile;
    this.text(fit(v.title, 24), 10, L.head, 9, v.naming?.problem && !v.title.startsWith('SAVE') ? INK : HALF, 700, 'left', 0.9);
    const right = PAGE_HEAD.right;
    const rw = v.count ? this.text(v.count, right, L.head, 9, HALF, 600, 'right') : 0;
    if (v.group) this.text(v.group, right - rw - (rw ? 6 : 0), L.head, 9, INK, 600, 'right', 0.4);
    const mid = L.rows[1];
    if (v.stage === 'name' && v.naming) {
      // Le nom en cours : l'utilisateur sur ses quatre cases (une case vide : un trait), la barre, le nom ; le curseur
      const t = v.naming.text;
      const size = 21;
      const shown = `${t.slice(0, 4).replace(/ /g, '_')}${t.slice(4)}`;
      const w = this.textWidth(shown, size, 300, 1.2);
      const x0 = UW / 2 - w / 2;
      this.text(shown, x0, mid + 7, size, INK, 300, 'left', 1.2);
      if (desk) {
        const at = Math.min(v.naming.at, shown.length);
        const cx = x0 + (at > 0 ? this.textWidth(shown.slice(0, at), size, 300, 1.2) + 1.2 : 0);
        const cw = Math.max(9, this.textWidth(shown[at] && shown[at] !== ' ' ? shown[at] : 'M', size, 300));
        this.line([cx - 0.5, mid + 11.5, cx + cw + 0.5, mid + 11.5], INK, 2.2);
      }
      const help = v.naming.problem || (desk ? 'A: LETTER   B: CURSOR' : 'TYPE THE NAME, THEN OK');
      this.text(help, UW / 2, L.hint, 7.5, v.naming.problem ? INK : FAINT_TEXT, 700, 'center', 0.8);
      this.info.presetList = `|${t}|@${v.naming.at}|${v.keys.join(',')}`;
    } else {
      // La ligne d'avant et d'apres : a peine, petites (le haut et le bas de la liste)
      if (v.prev) this.text(fit(v.prev, 30), UW / 2, L.rows[0], 9, FAINT_TEXT, 600, 'center', 0.7);
      if (v.next) this.text(fit(v.next, 30), UW / 2, L.rows[2], 9, FAINT_TEXT, 600, 'center', 0.7);
      const name = this.fitText(v.name, UW - 64, 21, 0.3, 300);
      this.text(name, UW / 2, mid + 7, 21, INK, 300, 'center', 0.3);
      if (!v.empty && v.stage === 'browse') {
        this.line([18, mid - 7, 10, mid, 18, mid + 7], INK, 2);
        this.line([UW - 18, mid - 7, UW - 10, mid, UW - 18, mid + 7], INK, 2);
      }
      const q = v.stage === 'choice' ? 'OVERWRITE IT, OR SAVE AS NEW?' : v.stage === 'confirm' ? 'DELETE FOR GOOD?' : desk && v.stage === 'browse' ? 'TURN A KNOB: BROWSE' : '';
      if (q) this.text(q, UW / 2, v.stage === 'browse' ? L.hint : L.sub, v.stage === 'browse' ? 7 : 8, v.stage === 'browse' ? FAINT_TEXT : INK, 700, 'center', 0.8);
      this.info.presetList = `${v.prev}|${v.name}|${v.next}|${v.keys.join(',')}`;
    }
    // Les cinq touches : une pastille par place, vide si la place n'a rien a faire
    v.keys.forEach((k, i) => {
      if (!k) return;
      const spot = presetKeySpot(i, this.mobile);
      const cx = spot.u * UW;
      const w = this.textWidth(k, L.keyFont, 700, 0.8) + (this.mobile ? 16 : 12);
      this.pill(cx - w / 2, L.keyY - L.keyH / 2, w, L.keyH, null, INK, 1.2);
      this.text(k, cx, L.keyY + L.keyFont * 0.36, L.keyFont, INK, 700, 'center', 0.8);
      // Au desktop (la revue de D1, K1) : le nom de la touche de la face qui la fait (SRC LOAD, FLTR SAVE, AMP NAME, FX DEL, PTN
      // EXIT) ; FLTR, AMP et FX sont sous les potards, leurs pastilles rangees a droite de l'ecran
      if (!this.mobile) this.text(softKeyName(PRESET_SLOTS[i]), cx, L.keyY - L.keyH / 2 - 3.2, 6, FAINT_TEXT, 700, 'center', 0.8);
    });
  }

  /**
   * La ligne du bas a droite (HOME, EDIT) : le message du moment, ou la piste
   * et sa barre, sinon rien ; la page MIX n'y ecrit rien. La vue PAGE a son
   * pied (paintFoot).
   */
  private paintLine(s: LcdState, rytmEdit: boolean): void {
    const x0 = COL.x0;
    const x1 = COL.x1;
    if (s.mix) return;
    if (s.bar !== null) {
      // La piste : son titre, la position et la duree, une barre fine et son point
      const title = s.l2.trim();
      this.text(fit(title, 26), x0, LINE.y - 9, 7, HALF, 600, 'left', 0.5);
      const lw = this.text(s.l3, x0, LINE.y + 4, 7, INK, 600);
      const rw = this.text(s.r3, x1, LINE.y + 4, 7, INK, 600, 'right');
      const a = x0 + lw + 5;
      const b = x1 - rw - 5;
      if (b - a > 10) {
        const y = LINE.y + 1.5;
        const v = Math.max(0, Math.min(1, s.bar));
        this.line([a, y, b, y], FAINT, 1.4);
        this.line([a, y, a + (b - a) * v, y], INK, 1.8);
        this.circle(a + (b - a) * v, y, 2.6, INK);
        this.bar = { x0: a * TEX_K, x1: b * TEX_K, y0: (LINE.y - 8) * TEX_K, y1: (LINE.y + 8) * TEX_K };
      }
      return;
    }
    if (s.l3) {
      // A la largeur de la colonne (le message garde 40 lettres depuis le 2026-10-08, state/lcd.ts)
      this.text(this.fitText(s.l3, x1 - x0, 9, 0.6, 600), x0, LINE.y, 9, INK, 600, 'left', 0.6);
      return;
    }
    // La vue BANK (V.5.2) : ce que font ses pas
    if (rytmEdit) this.text(DT_FACE && dtFace.bank() ? 'STEPS 1-8: BANKS A-H   PTN: BACK' : 'TAP: PLAY   TAP TAP: CHAIN', x0, LINE.y, 7, FAINT_TEXT, 700, 'left', 0.6);
    else if (this.paintMode(x0, x1)) return;
    // Les presets (V.4.2 : au desktop l'ecran ne se touche plus, EDIT pressee deux fois les ouvre)
    else if (s.tag) this.text(SCREEN_TOUCH ? 'TOUCH: PRESETS' : DT_FACE ? 'PTN 2X: KIT' : 'EDIT 2X: PRESETS', x1, LINE.y, 6.5, FAINT_TEXT, 700, 'right', 0.8);
  }

  /**
   * Le menu de la voix sous HOME (2026-10-18, HOME_MENU) : dans la bande que le dessin de 120 laisse en bas de l'ecran
   * haut (DY), cinq touches en contour, de bord a bord ; sans voix choisie, SOUND a peine. Leurs zones : menuRects.
   */
  private paintHomeMenu(inst: Inst | null): void {
    if (DY < 12) return;
    const n = HOME_MENU.length;
    const x0 = 10;
    const x1 = UW - 10;
    const gap = 6;
    const h = Math.min(14, DY - 4);
    const y = UH - h - 2.5;
    const w = (x1 - x0 - gap * (n - 1)) / n;
    const size = this.mobile ? 7.5 : 7;
    // La barre de la piste, deja dessinee par paintLine (2026-10-22, revue RB3-1) : ses bords en unites, un peu d'air
    const bx = this.mobile && this.bar ? [this.bar.x0 / TEX_K - 4, this.bar.x1 / TEX_K + 4] : null;
    HOME_MENU.forEach((id, i) => {
      const x = x0 + i * (w + gap);
      const off = id === 'sound' && !inst;
      this.roundRect(x, y, w, h, 3.5, null, off ? FRAME_DIM : HALF, 1.1);
      this.text(HOME_MENU_LABEL[id], x + w / 2, y + h / 2 + size * 0.36, size, off ? FAINT : INK, 700, 'center', 0.8);
      // Au telephone, la zone monte au-dessus de la touche jusqu'au bas du verre (MENU_HIT_TOP, 2026-10-22). Revue RB3-1
      // (2026-10-22) : sous la barre de la piste (FLTR ENV FX), elle s'arrete au bas de sa bande (OLED_BAR.bandY1), une
      // tape ou un glisse sur la barre fait avancer la piste au lieu d'ouvrir la page ; SOUND et VOICE, loin de la barre,
      // gardent toute leur hauteur (la bande ramenerait la piste au debut)
      const overBar = bx !== null && x < bx[1] && x + w > bx[0];
      const top = !this.mobile ? y : overBar ? Math.max(DY + MENU_HIT_TOP, OLED_BAR.bandY1 / TEX_K) : DY + MENU_HIT_TOP;
      this.menuRects.push({ id: `lcd-menu-${id}`, ...this.spot({ x, y: top, w, h: this.mobile ? UH - top : h }) });
      this.info.menu.push(off ? `-${HOME_MENU_LABEL[id]}` : HOME_MENU_LABEL[id]);
    });
  }

  /**
   * MUTE et SOLO (2026-10-07, Mika : "l'ecran affiche la difference et le
   * tip du double MUTE") : le mode du moment a gauche, son tip a droite ;
   * false sans mode ni voix coupee.
   */
  private paintMode(x0: number, x1: number, y: number = LINE.y, big = 9, small = 6.5): boolean {
    const m = modeLines();
    if (!m) return false;
    // Les voix d'abord : l'aide courte si la longue ne laisse pas la liste entiere
    const lw = this.textWidth(m.left, big, 600, 0.6);
    const tip = lw + 8 + this.textWidth(m.tip, small, 700, 0.8) <= x1 - x0 ? m.tip : m.short;
    const tw = this.text(tip, x1, y, small, HALF, 700, 'right', 0.8);
    const left = this.fitText(m.left, Math.max(20, x1 - x0 - tw - 8), big, 0.6);
    this.text(left, x0, y, big, INK, 600, 'left', 0.6);
    this.info.footText = `${left} / ${tip}`;
    return true;
  }

  /* ---------------- la vue PAGE (2026-10-08 ; l'etape 2, 2026-10-09) ---------------- */

  /**
   * La vue PAGE : l'en-tete (la page, ses onglets, la voix ; en P-LOCK tout en
   * negatif), les blocs de l'ecran dans leurs cases (le navigateur des sons,
   * 2026-10-18, a son propre dessin : paintBrowser), le pied (les seize pas et la tete de lecture, le
   * message, la piste, MUTE et SOLO, l'aide) ; le popup d'un encodeur du
   * desktop par-dessus. Rend dans combien de ms il faut un autre dessin (la fin
   * de l'echo, du popup ; 0 : aucun ; paint() en arme le minuteur).
   */
  private paintPage(s: LcdState, rp: RytmPageState, inst: Inst | null, cur: number, now: number, lockStep: number): number {
    let next = 0;
    this.meterLive = false;
    const mode = this.blockMode(inst, lockStep, now);
    const screen = screenIn(rp, inst);
    this.info.screen = screen;
    // L'en-tete dit ce que joue le pas montre (revue de R3)
    const shownLock = !inst || !mode ? null : mode.kind === 'lock' ? lockOf(pattern.get().locks, inst, mode.step) : mode.kind === 'flash' ? mode.lock : null;
    this.paintPageHead(rp, screen, inst, cur, now, lockStep, shownLock, mode);
    this.blockRects = [];
    {
      const blocks = pageBlocks(rp, inst, now, mode);
      this.paintMatrix(blocks, inst, mode);
      for (const b of blocks) if (b.state !== 'empty' && !b.graph) this.blockRects.push({ k: b.k, ...this.spot(cellRect(b.cell)) });
      // INFOS (R4) : le bloc dont la carte est montree, ses quatre coins
      const ik = this.infoKnob();
      if (ik >= 0 && blocks[ik] && blocks[ik].state !== 'empty') this.infoMarks(blocks[ik].cell, ik);
      // Les verrous du pas, toutes pages, dans la place que l'ecran laisse vide (revue de R2)
      const slots = pageSlots(screen, inst);
      const panel = mode && mode.kind !== 'scene' ? this.paintLockPanel(slots, mode.step, mode.kind === 'flash' ? mode.lock : undefined) : null;
      // Les cases libres : un cadre en pointilles (au telephone les blocs sont les potards ; au desktop aussi depuis le 2026-10-09)
      this.paintGhosts(slots, panel);
      this.info.blocks = blocks.map((b) => `${b.label}=${b.text}:${b.state}${b.lock !== 'none' ? `/${b.lock}` : ''}${b.flash ? '!' : ''}${b.quiet ? '~' : ''}${b.morph ? `@${b.morph}` : ''}`);
      // Un bloc morphe a l'ecran (P2-20) : le crossfader qui bouge le redessine (xTick)
      if (blocks.some((b) => b.morph)) this.xLive = true;
      this.info.flash = blocks.filter((b) => b.flash).map((b) => b.k);
      this.info.cells = blocks.map((b) => `${b.cell.c},${b.cell.r},${b.cell.w},${b.cell.h}`);
      const echo = blocks.find((b) => b.echo);
      if (echo) this.info.echo = echo.k;
      this.info.hover = rp.hover;
      // La fin de l'echo a son heure ; un bloc tenu reste cerne sans minuteur, son lacher redessine
      if (echo && rp.echo && rp.echo.page === screen && now < rp.echo.until) next = Math.max(1, rp.echo.until - now + 1);
    }
    this.paintStrip(inst, rp.sel, lockStep, mode && mode.kind === 'flash' ? mode.step : -1);
    const more = this.paintFoot(s, screen, lockStep, now, mode && mode.kind === 'flash' ? mode : null);
    if (more > 0) next = next > 0 ? Math.min(next, more) : more;
    // Le popup d'un encodeur du desktop (2026-10-09) : son FX global par-dessus, un instant
    const pop = rp.popup;
    this.info.popup = '';
    if (pop && now < pop.until) {
      this.paintPopup(pop.id);
      next = next > 0 ? Math.min(next, pop.until - now + 1) : pop.until - now + 1;
    }
    // L'aiguille du COMP (2026-10-18) : une image toutes les 50 ms tant qu'elle bouge
    if (this.meterLive) next = next > 0 ? Math.min(next, METER_MS) : METER_MS;
    return next;
  }

  /** Une zone de dessin (unites) en part du verre (u, v de 0 a 1) : les zones de saisie des blocs et des onglets. */
  private spot(r: { x: number; y: number; w: number; h: number }): { u0: number; u1: number; v0: number; v1: number } {
    return { u0: r.x / UW, u1: (r.x + r.w) / UW, v0: r.y / UH, v1: (r.y + r.h) / UH };
  }

  /**
   * Les verrous a montrer (2026-10-08) : ceux du pas en P-LOCK ; sinon, en
   * lecture, ceux du pas qui joue s'il sonne (un coup, la voix pas coupee).
   * Depuis la revue de R2, le flash tient jusqu'au coup suivant de la voix,
   * au moins FLASH.min pour se lire, au plus FLASH.max.
   */
  private blockMode(inst: Inst | null, lockStep: number, now: number): BlockMode | null {
    if (lockStep >= 0) {
      this.flash = null;
      return { kind: 'lock', step: lockStep };
    }
    // Une scene armee (2026-10-27, P2-19) : ses cles sur les blocs, son en-tete ; jamais avec un P-LOCK garde
    const arm = sceneCtl.get().armed;
    if (arm) {
      this.flash = null;
      return { kind: 'scene', which: arm };
    }
    if (!inst || !clock.running) {
      this.flash = null;
      this.flashHead = -1;
      return null;
    }
    const head = playhead.get();
    if (head !== this.flashHead) {
      this.flashHead = head;
      if (head >= 0 && velocity(pattern.get().steps, inst, head) > 0 && voices.plays(inst, pmutesNow())) {
        const lock = lockOf(pattern.get().locks, inst, head);
        const f = this.flash;
        if (lock) this.flash = { inst, step: head, lock, from: now, end: now + FLASH.max };
        else if (f) f.end = Math.min(f.end, Math.max(now, f.from + FLASH.min));
      }
    }
    const f = this.flash;
    if (f && (f.inst !== inst || now >= f.end)) this.flash = null;
    return this.flash ? { kind: 'flash', step: this.flash.step, lock: this.flash.lock } : null;
  }

  /**
   * Le panneau des verrous (revue de R2) : les verrous du pas en P-LOCK, ou du
   * pas qui joue, toutes pages, dans la plus grande place que l'ecran laisse
   * libre (deux colonnes au moins sur une rangee, ou une colonne sur deux) ;
   * rien si l'ecran est plein (l'en-tete en dit le compte, le pied la liste).
   */
  private paintLockPanel(slots: readonly PageSlot[], step: number, lockArg?: Readonly<StepLock> | null): PanelArea | null {
    const M = MATRIX;
    const free = freeCells(slots);
    const isFree = (c: number, r: number): boolean => free.some((x) => x.c === c && x.r === r);
    let best: PanelArea | null = null;
    const consider = (c0: number, n: number, r0: number, rows: number): void => {
      if (n < 1 || (rows === 1 && n < 2)) return;
      if (!best || n * rows > best.n * best.rows || (n * rows === best.n * best.rows && n > best.n)) best = { c0, n, r0, rows };
    };
    for (const rows of [2, 1]) {
      for (let r0 = 0; r0 + rows <= 2; r0 += 1) {
        let c0 = -1;
        for (let c = 0; c <= 4; c += 1) {
          const ok = c < 4 && isFree(c, r0) && (rows === 1 || isFree(c, r0 + 1));
          if (ok && c0 < 0) c0 = c;
          if (!ok && c0 >= 0) {
            consider(c0, c - c0, r0, rows);
            c0 = -1;
          }
        }
      }
    }
    const b = best as PanelArea | null;
    if (!b) return null;
    const lines: LockLine[] = lockList(step, lockArg);
    const x0 = M.x0 + M.pitch * b.c0;
    const x1 = x0 + M.pitch * (b.n - 1) + M.w;
    const y0 = M.rows[b.r0];
    const y1 = M.rows[b.r0 + b.rows - 1] + M.h;
    const T = this.bt;
    const pad = 5;
    this.roundRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1, M.r, null, FRAME, 0.7);
    const title = `STEP ${two(step + 1)} ${lockArg !== undefined ? 'PLAYS' : 'P-LOCKS'}`;
    this.text(this.fitText(title, x1 - x0 - 2 * pad, T.nameSize, 0.7, 700), x0 + pad, y0 + T.nameDy, T.nameSize, HALF, 700, 'left', 0.7);
    const size = T.panelSize;
    const lh = T.panelLh;
    let y = y0 + T.nameDy + lh + 0.6;
    const bottom = y1 - 3;
    const out: string[] = [];
    if (lines.length === 0) {
      this.text(this.fitText(`NONE YET: ${TURN}`, x1 - x0 - 2 * pad, size, 0.5, 600), x0 + pad, y, size, FAINT_TEXT, 600, 'left', 0.5);
      this.info.panel = ['NONE'];
      return b;
    }
    for (let i = 0; i < lines.length; i += 1) {
      const last = y + lh > bottom;
      if (last && i < lines.length - 1) {
        const more = `+${lines.length - i} MORE`;
        this.text(more, x0 + pad, y, size, HALF, 700, 'left', 0.5);
        out.push(more);
        break;
      }
      const l = lines[i];
      const pw = b.n > 1 ? this.text(l.page, x1 - pad, y, size * 0.82, FAINT_TEXT, 700, 'right', 0.5) + 4 : 0;
      const nw = this.text(l.name, x0 + pad, y, size, HALF, 700, 'left', 0.5);
      const room = x1 - pad - pw - (x0 + pad + nw + 3);
      this.text(this.fitText(l.text, Math.max(6, room), size, 0.3, 600), x0 + pad + nw + 3, y, size, INK, 600, 'left', 0.3);
      out.push(`${l.page} ${l.name} ${l.text}`);
      y += lh;
      if (y > bottom + 0.01) break;
    }
    this.info.panel = out;
    return b;
  }

  /**
   * Les cases libres d'un ecran (revue du 2026-10-09 : une page creuse, un
   * seul bloc sur un ecran noir, la grille disparaissait) : un cadre en
   * pointilles a peine marque, sauf la ou le panneau des verrous a pris la place.
   */
  private paintGhosts(slots: readonly PageSlot[], panel: PanelArea | null): void {
    const M = MATRIX;
    const c = this.ctx;
    c.save();
    c.setLineDash([2.4, 2.2]);
    for (const f of freeCells(slots)) {
      if (panel && f.c >= panel.c0 && f.c < panel.c0 + panel.n && f.r >= panel.r0 && f.r < panel.r0 + panel.rows) continue;
      this.roundRect(M.x0 + M.pitch * f.c + 0.5, M.rows[f.r] + 0.5, M.w - 1, M.h - 1, M.r, null, FRAME_DIM, 0.7);
    }
    c.restore();
  }

  /** Un petit cadenas (x : son bord gauche, y : le bas de son corps), plein. */
  private padlock(x: number, y: number, s: number, color: string): void {
    const c = this.ctx;
    const w = s;
    const h = s * 0.72;
    c.fillStyle = color;
    c.fillRect(x, y - h, w, h);
    c.beginPath();
    c.arc(x + w / 2, y - h, w * 0.32, Math.PI, 0);
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.7, s * 0.17);
    c.stroke();
  }

  /**
   * L'en-tete de la vue PAGE (refait le 2026-10-09) :
   * - a gauche la lecture, la page en pastille pleine (VOICE), ses onglets
   *   s'il en a (MAIN SYNTH ; BD FX, GLOBAL : celui de l'ecran plein, l'autre en
   *   contour, une tape dessus y passe) ;
   * - a droite la voix, le pattern (il clignote quand il change), MASTER et le
   *   tempo ; M ou S quand le mode est arme, entre la voix et le pattern ;
   * - entre les deux, ce que joue la voix quand la place le permet, MUTE ou
   *   SOLO pour une voix vraiment coupee (en solo), P-LOCK un instant quand le
   *   pas qui joue a des verrous (n'importe quelle page) ;
   * - la page d'un FX global (2026-10-10) : GLOBAL > DELAY a la place de
   *   l'onglet GLOBAL, le FX cerne, une tape dessus ramene GLOBAL FX ; sous
   *   DIST CHORUS DELAY REVERB, l'onglet de la voix est la voix elle-meme ;
   * - en P-LOCK (69-common2, point 3 : "P-LOCK MUST BE OBVIOUS") : toute la
   *   bande en negatif (paintLockHead).
   * 2026-10-22 (audit SB-13 : la voix BD sautait de x 69 a 160 d'une page a
   * l'autre, A01 et le niveau en dB allaient et venaient) : des places fixes.
   * La voix a sa colonne juste a gauche du pattern, a la meme place sur toutes
   * les pages, et les cadrans gardent le meme palier sur toutes les pages
   * (headPlan) ; ce sont les onglets qui se serrent (HEAD_FIT), pas la voix qui
   * bouge. MASTER tenu dit son niveau en dB.
   */
  private paintPageHead(rp: RytmPageState, screen: RytmScreenId, inst: Inst | null, cur: number, now: number, lockStep: number, lock: Readonly<StepLock> | null, mode: BlockMode | null): void {
    const H = PAGE_HEAD;
    const T = this.bt.head;
    const y = H.y;
    this.tabSpots = [];
    if (lockStep >= 0) {
      this.paintLockHead(screen, inst, lockStep);
      return;
    }
    if (mode && mode.kind === 'scene') {
      this.paintSceneHead(screen, inst, mode.which);
      return;
    }
    const ty = H.pillY + T.pillH / 2 + T.pill * 0.36;
    const v = voices.get();
    const badge = v.muteMode ? 'M' : v.soloMode ? 'S' : '';
    const plan = this.headPlan(!!badge);
    const scope = fxScopeTabs(screen);
    const vx = plan.voiceX;
    // La gauche : la page et ses onglets, au premier palier qui laisse la colonne de la voix (BD FX cede d'abord sa place)
    const limit = vx - (scope ? HEAD_COL.tabAir : HEAD_COL.air);
    let left: HeadLeft | null = null;
    let fitAt = -1;
    for (let l = 0; l < HEAD_FIT.length && !left; l += 1) {
      for (const optional of [true, false]) {
        const h = this.headLeft(rp.page, screen, inst, HEAD_FIT[l], optional);
        if (h.end <= limit) {
          left = h;
          fitAt = l;
          break;
        }
      }
    }
    // Rien ne tient (une police de repli tres large) : les onglets au plus serre, la voix se tait plutot que d'etre ecrasee
    const crowded = !left;
    const shown: HeadLeft = left ?? this.headLeft(rp.page, screen, inst, HEAD_FIT[HEAD_FIT.length - 1], false);
    // MASTER tenu : son niveau en dB a la place du pattern et de la voix, le temps du geste (paintDials)
    const readout = !plan.tier.full && screenDials.get().held === 'level';
    // La zone de MASTER au telephone, sans A01 : l'air libre a sa gauche, apres la voix (ou apres son onglet, une commande)
    const vw = this.textWidth(inst ?? 'ALL', T.voice, 600);
    const zoneLeft = (scope ? vx + plan.colW + 3.5 : vx + vw) + 3;
    this.paintDials(y, 0, H.rule, now, cur, 0, { tier: plan.tier, zoneLeft, readout });
    this.runIcon(H.iconX, y);
    this.drawHeadLeft(shown, ty);
    this.paintPageDots(rp, shown.pw, inst);
    let heads = shown.heads;
    // MUTE et SOLO armes (2026-10-09) : M ou S, plein en MULTI, en contour pour une voix, entre la voix et le pattern
    if (badge) {
      const multi = v.muteMode ? v.muteMulti : v.soloMulti;
      if (!readout) {
        const bw = T.pillH;
        const bx = vx + plan.colW + HEAD_COL.badgeAir;
        if (multi) this.roundRect(bx, H.pillY, bw, T.pillH, 2.5, INK);
        else this.roundRect(bx + 0.5, H.pillY + 0.5, bw - 1, T.pillH - 1, 2.5, null, INK, 1);
        this.text(badge, bx + bw / 2, ty, T.pill, multi ? BLACK : INK, 700, 'center');
      }
      this.info.badge = `${badge}${multi ? '+' : ''}`;
    } else this.info.badge = '';
    // La colonne de la voix ; sous DIST CHORUS DELAY REVERB (2026-10-10, Mika : "Quand je suis la page delay je veux avoir le
    // choix entre GLOBAL ou VOICE"), elle est l'onglet de la voix : cernee sous la voix, a peine sous GLOBAL, une tape y passe
    if (scope) {
      const on = screen === scope.voice;
      const name = fxVoiceTabLabel(inst);
      if (!readout && !crowded) {
        // Le cadre de l'onglet : HEAD_COL.tabPad de part et d'autre (relecture : a 3.5, TOM cerne touchait presque A01)
        const tp = HEAD_COL.tabPad;
        if (inst) {
          if (on) this.roundRect(vx - tp, H.pillY + 0.6, vw + 2 * tp, T.pillH - 1.2, 2.2, null, INK, 1.1);
          this.text(inst, vx, y, T.voice, on ? INK : FAINT_TEXT, 600);
        } else {
          // Sans voix : VOICE en onglet, du corps des onglets, dans la largeur de la colonne
          const ts0 = T.pill * 0.92;
          const ts = ts0 * Math.min(1, (plan.colW - 1) / Math.max(1, this.textWidth(name, ts0, 700, 0.7)));
          const nw = this.textWidth(name, ts, 700, 0.7);
          if (on) this.roundRect(vx - tp, H.pillY + 0.6, nw + 2 * tp, T.pillH - 1.2, 2.2, null, INK, 1.1);
          this.text(name, vx, ty, ts, on ? INK : FAINT_TEXT, 700, 'left', 0.7);
        }
      }
      // Sa zone : la colonne et un peu d'air, jamais sur celle de MASTER (le telephone sans A01 : 0.3 unite communes)
      const tx1 = Math.min(vx + plan.colW + 3.5, plan.groupLeft - 3.5);
      this.tabSpots.push({ screen: scope.voice, ...this.spot({ x: vx - 4, y: -this.headUp, w: tx1 - vx + 4, h: H.rule + this.headUp }) });
      heads += `|${on ? '[' : ''}${name}${on ? ']' : ''}`;
    } else if (!readout && !crowded) this.text(inst ?? 'ALL', vx, y, T.voice, inst ? INK : HALF, 600);
    this.info.head = heads;
    this.info.headFit = `${plan.tier.a01 ? 'A01' : '-'}${plan.tier.full ? '+DB' : ''}|voice@${vx.toFixed(1)}|fit${fitAt}${crowded ? '!' : ''}${readout ? '|DB' : ''}`;
    if (readout || crowded) {
      this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
      return;
    }
    // Entre les onglets et la voix, de droite a gauche : MUTE ou SOLO de la voix, P-LOCK, ce que joue la voix
    const mid0 = shown.end + 5;
    let x1 = vx - (scope ? HEAD_COL.tabPad + 4 : 5);
    const fits = (w: number): boolean => x1 - w >= mid0;
    if (inst) {
      // Une voix vraiment coupee (en solo) : sa pastille ; une voix hors d'un solo n'en a pas (2026-10-09 : MUTE se lisait a tort)
      const solo = voices.isSolo(inst);
      const muted = voices.isMuted(inst) && v.solo.length === 0;
      if (solo || muted) {
        // Le mot entier s'il tient, sinon sa lettre (le telephone : MUTE couvrait A01)
        const full = solo ? 'SOLO' : 'MUTE';
        const fw = this.textWidth(full, T.sound, 700, 0.8) + 8;
        const word = fits(fw) ? full : solo ? 'S' : 'M';
        const w = word === full ? fw : this.textWidth(word, T.sound, 700, 0.8) + 8;
        if (fits(w)) {
          x1 -= w;
          this.pill(x1, H.pillY, w, T.pillH, INK);
          this.text(word, x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 700, 'center', 0.8);
          x1 -= 5;
        }
      }
      // FILL tenu (V.5.1, tenir YES) : sa pastille pleine, avant tout le reste du milieu
      if (DT_FACE && fill.on) {
        const w = this.textWidth('FILL', T.sound, 800, 0.6) + 8;
        if (fits(w)) {
          x1 -= w;
          this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
          this.text('FILL', x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
          this.info.head += '|FILL';
          x1 -= 5;
        }
      }
      // CONTROL ALL (V.5.2, TRK + un potard d'une page de voix) : sa pastille pleine pendant le geste
      if (DT_FACE && ctlAllState.get()) {
        const full = this.textWidth('CONTROL ALL', T.sound, 800, 0.6) + 8;
        const word = fits(full) ? 'CONTROL ALL' : 'ALL';
        const w = word === 'ALL' ? this.textWidth(word, T.sound, 800, 0.6) + 8 : full;
        if (fits(w)) {
          x1 -= w;
          this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
          this.text(word, x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
          x1 -= 5;
        }
        this.info.head += '|CONTROL ALL';
      }
      // Le pas qui joue a des verrous (n'importe quelle page) : P-LOCK un instant, plein (69-common2, point 3)
      if (mode && mode.kind === 'flash') {
        const word = 'P-LOCK';
        const w = this.textWidth(word, T.sound, 800, 0.6) + 8;
        if (fits(w)) {
          x1 -= w;
          this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
          this.text(word, x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
          this.info.head += '|P-LOCK!';
          x1 -= 5;
        }
      }
      // Ce que joue la voix, a la place qui reste (VOICE le montre en grand dans SOUND : rien ici) ; ecrit comme SOUND
      // (revue du 2026-10-09 : 909+BLUEPRINT ici, BLUEPRINT + 909 dans SOUND), jamais coupe au milieu d'un nom (BLUEP.) :
      // le sample seul s'il n'y a pas la place des deux, sinon rien. La page d'un FX sous GLOBAL (2026-10-10) : la quantite
      // de la machine, ce que joue la voix n'y a rien a faire
      const room = x1 - mid0;
      if (rp.page !== 'voice' && room > 18 && !(scope && screen === scope.global)) {
        const plays = voiceSoundText(inst, stepPlays(inst, lock));
        const txt = plays === inst ? '' : ([plays, plays.split(' + ')[0]].find((t) => this.textWidth(t, T.sound, 600, 0.6) <= room) ?? '');
        if (txt) this.text(txt, x1, y, T.sound, HALF, 600, 'right', 0.6);
      }
    } else if (DT_FACE && fill.on && fits(this.textWidth('FILL', T.sound, 800, 0.6) + 8)) {
      // FILL tenu sans voix choisie (V.5.1) : sa pastille a la place de PICK A VOICE
      const w = this.textWidth('FILL', T.sound, 800, 0.6) + 8;
      x1 -= w;
      this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
      this.text('FILL', x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
      this.info.head += '|FILL';
    } else if (fits(this.textWidth('PICK A VOICE', T.sound * 0.85, 600, 0.5))) {
      // Sans voix : PICK A VOICE devant ALL (ou devant l'onglet VOICE d'une page de FX) s'il tient
      this.text('PICK A VOICE', x1, y, T.sound * 0.85, FAINT_TEXT, 600, 'right', 0.5);
    }
    this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
  }

  /**
   * L'en-tete en P-LOCK (69-common2, point 3 : "P-LOCK MUST BE OBVIOUS") : toute
   * la bande en negatif, P-LOCK STEP 05, la page et P-LOCKS (ENV · P-LOCKS), la
   * voix, le compte des verrous du pas (3 P-LOCKS) sur toutes les pages ; M ou
   * S quand le mode est arme. Le dessin d'avant le 2026-10-22, sorti tel quel
   * de paintPageHead.
   */
  private paintLockHead(screen: RytmScreenId, inst: Inst | null, lockStep: number): void {
    const H = PAGE_HEAD;
    const T = this.bt.head;
    const y = H.y;
    this.ctx.fillStyle = INK;
    this.ctx.fillRect(0, 0, UW, H.rule + 0.6);
    const ink = BLACK;
    const ty = H.pillY + T.pillH / 2 + T.pill * 0.36;
    // A droite d'abord : le compte des verrous
    const n = lockCountOf(lockStep);
    const word = n === 1 ? '1 P-LOCK' : `${n} P-LOCKS`;
    const cw = this.text(word, H.right, y, T.bpm * 1.12, ink, 700, 'right', 0.7);
    let rightX = H.right - cw - 6;
    this.info.lockCount = n;
    // MUTE et SOLO armes (2026-10-09) : M ou S, plein en MULTI, en contour pour une voix (meme en P-LOCK)
    const v = voices.get();
    const badge = v.muteMode ? 'M' : v.soloMode ? 'S' : '';
    if (badge) {
      const multi = v.muteMode ? v.muteMulti : v.soloMulti;
      const bw = T.pillH;
      const bx = rightX - bw;
      if (multi) this.roundRect(bx, H.pillY, bw, T.pillH, 2.5, ink);
      else this.roundRect(bx + 0.5, H.pillY + 0.5, bw - 1, T.pillH - 1, 2.5, null, ink, 1);
      this.text(badge, bx + bw / 2, ty, T.pill, multi ? INK : ink, 700, 'center');
      rightX = bx - 5;
      this.info.badge = `${badge}${multi ? '+' : ''}`;
    } else this.info.badge = '';
    // FILL tenu (V.5.1, la revue de D2, U6) : sa pastille aussi en P-LOCK, en negatif comme la bande
    rightX = this.negFill(rightX);
    this.info.headFit = '';
    // P-LOCK STEP 05 : le cadenas, le pas ; puis la page et P-LOCKS en contour
    const gs = T.pill * 0.82;
    this.padlock(H.iconX - 1, ty, gs, BLACK);
    const lk = `P-LOCK STEP ${two(lockStep + 1)}`;
    const lw = this.text(lk, H.iconX - 1 + gs + 3.5, ty, T.pill, BLACK, 800, 'left', 0.8);
    let x = H.iconX - 1 + gs + 3.5 + lw + 6;
    const room = rightX - x - (inst ? this.textWidth(inst, T.voice, 700) + 8 : 0);
    // ENV · P-LOCKS ; trop long (VOICE SYNTH au telephone) : le nom de l'ecran seul, la bande dit deja P-LOCK
    const full = `${SCREEN_TITLE[screen]} · P-LOCKS`;
    const max = Math.max(20, room - 10);
    // La page d'un FX global (2026-10-10, le telephone : GLOBAL FX · . ) : GLOBAL REVERB, puis REVERB, avant de couper
    const label = [full, SCREEN_TITLE[screen], tabWord(screen, inst), SCREEN_LABEL[screen]].find((t) => this.textWidth(t, T.pill, 700, 0.7) <= max) ?? SCREEN_TITLE[screen];
    const fitted = this.fitText(label, max, T.pill, 0.7, 700);
    const pw = this.textWidth(fitted, T.pill, 700, 0.7) + 10;
    this.roundRect(x, H.pillY + 0.5, pw, T.pillH - 1, 2.5, null, BLACK, 0.9);
    this.text(fitted, x + pw / 2, ty, T.pill, BLACK, 700, 'center', 0.7);
    this.info.head = `${lk} | ${fitted}${DT_FACE && fill.on ? '|FILL' : ''}`;
    x += pw + 7;
    if (inst && x + 10 < rightX) this.text(inst, x, y, T.voice, BLACK, 700);
  }

  /**
   * L'en-tete d'une scene armee (2026-10-27, P2-19) : toute la bande en negatif comme le P-LOCK, SCENE A · 3 PARAMS · A01
   * (la scene, ce qu'elle garde, le pattern ou elle vit), la voix a droite.
   */
  private paintSceneHead(screen: RytmScreenId, inst: Inst | null, w: SceneId): void {
    const H = PAGE_HEAD;
    const T = this.bt.head;
    const y = H.y;
    this.ctx.fillStyle = INK;
    this.ctx.fillRect(0, 0, UW, H.rule + 0.6);
    const ty = H.pillY + T.pillH / 2 + T.pill * 0.36;
    let rightX = H.right;
    if (inst) rightX -= this.text(inst, H.right, y, T.voice, BLACK, 700, 'right') + 6;
    // FILL tenu (U6) : sa pastille aussi quand une scene est armee
    rightX = this.negFill(rightX);
    const n = sceneCount(pattern.scenes.get(), w);
    const head = `SCENE ${w === 'a' ? 'A' : 'B'} · ${n} PARAM${n === 1 ? '' : 'S'} · ${slotName(patterns.get().cur)}`;
    const fitted = this.fitText(head, Math.max(20, rightX - H.iconX - 4), T.pill, 0.8, 800);
    this.text(fitted, H.iconX - 1, ty, T.pill, BLACK, 800, 'left', 0.8);
    this.info.head = `${head}${DT_FACE && fill.on ? '|FILL' : ''}`;
    this.info.lockCount = 0;
    this.info.badge = '';
    this.info.headFit = '';
    void screen;
  }

  /** La pastille FILL sur une bande en negatif (P-LOCK, une scene armee), a gauche de rightX ; rend le nouveau bord. */
  private negFill(rightX: number): number {
    if (!DT_FACE || !fill.on) return rightX;
    const H = PAGE_HEAD;
    const T = this.bt.head;
    const w = this.textWidth('FILL', T.sound, 800, 0.6) + 8;
    const x = rightX - w;
    this.roundRect(x, H.pillY, w, T.pillH, 2.2, BLACK);
    this.text('FILL', x + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, INK, 800, 'center', 0.6);
    return x - 5;
  }

  /**
   * La gauche de l'en-tete de la vue PAGE au palier fit (2026-10-22, audit
   * SB-13), sans rien dessiner : la pastille de la page, puis ses onglets
   * (VOICE : MAIN SYNTH ; FX : BD FX GLOBAL ; la page d'un FX global : GLOBAL >
   * BIT ; sous DIST CHORUS DELAY REVERB : DELAY > GLOBAL, l'onglet de la voix
   * etant la colonne de la voix). optional false : sans BD FX sur la page d'un
   * FX global (il cede sa place le premier). end : le bord droit du dernier
   * onglet. paintPageHead la dessine (drawHeadLeft), headPlan la mesure.
   */
  private headLeft(page: RytmPageId, screen: RytmScreenId, inst: Inst | null, fit: HeadFit, optional: boolean): HeadLeft {
    const H = PAGE_HEAD;
    const T = this.bt.head;
    const label = pageLabel(page);
    const pw = this.textWidth(label, T.pill, 700, 0.9) + 12;
    const ts = T.pill * 0.92 * fit.s;
    const tabW = (name: string): number => this.textWidth(name, ts, 700, 0.7) + fit.pad;
    const chev = ts * 0.62;
    const chevStep = 1 + chev * 0.5 + fit.chev;
    const out: HeadLeft = { label, pw, ts, chev, ops: [], end: H.pillX + pw, heads: label };
    let x = H.pillX + pw + 5;
    const add = (op: HeadOp): void => {
      out.ops.push(op);
      out.end = op.kind === 'chev' ? x + 1 + chev * 0.5 : op.x + op.w;
    };
    const scope = fxScopeTabs(screen);
    const detail = isFxDetail(screen) ? screen : null;
    if (scope) {
      // Le FX en titre, un chevron, GLOBAL (la voix : sa colonne)
      const dn = SCREEN_LABEL[screen];
      const dw = this.textWidth(dn, ts, 700, 0.7) + fit.tpad;
      add({ kind: 'text', text: dn, x, w: dw, color: INK, align: 'left' });
      x += dw;
      add({ kind: 'chev', x, w: chev });
      x += chevStep;
      const gn = SCREEN_LABEL.fxg;
      const gw = tabW(gn);
      const on = screen === scope.global;
      add({ kind: 'tab', text: gn, x, w: gw, on, zone: { screen: scope.global, x0: x - 0.5, x1: x + gw + 0.5 } });
      out.heads += `|${dn}>|${on ? '[' : ''}${gn}${on ? ']' : ''}`;
      return out;
    }
    const tabs = screensOf(page, inst);
    // V.5.0 au desktop : SEND FX n'a qu'un onglet, la page de son FX garde GLOBAL > BIT
    if (tabs.length < 2 && !detail) return out;
    for (const t of tabs) {
      const name = t === 'fxv' ? (inst ? `${inst} FX` : 'VOICE FX') : SCREEN_LABEL[t];
      if (detail && t === 'fxv' && !optional) continue;
      if (detail && t === 'fxg') {
        // GLOBAL en retrait (une tape y revient), le chevron, le FX de la page cerne ; le tout est la zone de GLOBAL
        const x0 = x;
        const gw = tabW(name);
        add({ kind: 'text', text: name, x, w: gw, color: FAINT_TEXT, align: 'center' });
        x += gw;
        add({ kind: 'chev', x, w: chev });
        x += chevStep;
        const dn = SCREEN_LABEL[detail];
        const dw = tabW(dn);
        add({ kind: 'tab', text: dn, x, w: dw, on: true, zone: { screen: 'fxg', x0: x0 - 0.5, x1: x + dw + 0.5 } });
        out.heads += `|${name}>[${dn}]`;
        x += dw + fit.gap;
        continue;
      }
      const on = t === screen;
      const tw = tabW(name);
      // La zone de l'onglet : toute la hauteur de l'en-tete (la touche de la page la double, 44 px au doigt)
      add({ kind: 'tab', text: name, x, w: tw, on, zone: { screen: t, x0: x - 0.5, x1: x + tw + 0.5 } });
      out.heads += `|${on ? '[' : ''}${name}${on ? ']' : ''}`;
      x += tw + fit.gap;
    }
    return out;
  }

  /**
   * Les points de page (2026-10-27, desktop : la deuxieme page des huit potards, comme une Digitakt) : sous la pastille de
   * la page, deux points, celui de l'onglet montre plein ; seulement pour une page a deux onglets (VOICE avec SYNTH, FX).
   * Sous la pastille, dans l'air de l'en-tete : rien d'autre ne bouge (FLTR et ENV restent identiques).
   */
  private paintPageDots(rp: RytmPageState, pw: number, inst: Inst | null): void {
    if (!FACE_PAGES) return;
    const tabs = screensOf(rp.page, inst);
    if (tabs.length !== 2) return;
    const H = PAGE_HEAD;
    const T = this.bt.head;
    const cur = Math.max(0, Math.min(1, rp.tabs[rp.page] ?? 0));
    const r = PAGE_DOTS.r;
    const cy = (H.pillY + T.pillH + H.rule) / 2;
    const cx = H.pillX + pw / 2;
    for (let i = 0; i < 2; i += 1) this.circle(cx + (i - 0.5) * PAGE_DOTS.gap, cy, r, i === cur ? INK : FAINT_TEXT);
    this.info.pageDots = `${cur + 1}/2`;
  }

  /** Dessine la gauche de l'en-tete (headLeft) et pose les zones de ses onglets (lcd-tab-<ecran>). */
  private drawHeadLeft(h: HeadLeft, ty: number): void {
    const H = PAGE_HEAD;
    const T = this.bt.head;
    this.roundRect(H.pillX, H.pillY, h.pw, T.pillH, 2.5, INK);
    this.text(h.label, H.pillX + h.pw / 2, ty, T.pill, BLACK, 700, 'center', 0.9);
    for (const op of h.ops) {
      if (op.kind === 'chev') {
        const cy = H.pillY + T.pillH / 2;
        const ch = h.chev * 0.55;
        this.line([op.x + 1, cy - ch, op.x + 1 + h.chev * 0.5, cy, op.x + 1, cy + ch], HALF, 1);
        continue;
      }
      if (op.kind === 'text') {
        if (op.align === 'center') this.text(op.text, op.x + op.w / 2, ty, h.ts, op.color, 700, 'center', 0.7);
        else this.text(op.text, op.x, ty, h.ts, op.color, 700, 'left', 0.7);
        continue;
      }
      if (op.on) this.roundRect(op.x, H.pillY + 0.6, op.w, T.pillH - 1.2, 2.2, null, INK, 1.1);
      this.text(op.text, op.x + op.w / 2, ty, h.ts, op.on ? INK : FAINT_TEXT, 700, 'center', 0.7);
      this.tabSpots.push({ screen: op.zone.screen, ...this.spot({ x: op.zone.x0, y: -this.headUp, w: op.zone.x1 - op.zone.x0, h: H.rule + this.headUp }) });
    }
  }

  /**
   * Les places fixes de l'en-tete de la vue PAGE (2026-10-22, audit SB-13) : le
   * premier palier des cadrans (A01 et le dB, A01 seul, ni l'un ni l'autre) ou
   * les 16 ecrans de chacune des 8 voix tiennent leurs onglets, serres au plus
   * au palier HEAD_FIT_MAX, a gauche de la colonne de la voix ; la colonne a la
   * largeur de la plus large des voix (TOM), juste a gauche du pattern, la
   * lettre M ou S d'un mode arme entre les deux. Le meme sur toutes les pages
   * et pour toutes les voix (sans voix, VOICE FX plus long se serre plus : au
   * dernier palier de HEAD_FIT, 80 %, au desktop) ;
   * mesure : la voix a x 148.5 et A01 au desktop, 159 sans A01 au telephone
   * (172.3 colle aux cadrans, voir HEAD_FIT_PHONE). Garde jusqu'a l'arrivee des
   * polices (onFonts).
   */
  private headPlan(badge: boolean): HeadPlan {
    const key = badge ? 'badge' : 'plain';
    const hit = this.headPlans.get(key);
    if (hit) return hit;
    const T = this.bt.head;
    const g = this.dialGeom(0, true);
    const right = this.dialRight(true);
    const colW = Math.max(...[...INSTRUMENTS, 'ALL'].map((n) => this.textWidth(n, T.voice, 600)));
    const badgeW = badge ? T.pillH + HEAD_COL.badgeAir : 0;
    let plan: HeadPlan | null = null;
    // M ou S arme (2026-10-22, relecture) : la voix garde sa place de tous les jours si la lettre tient entre elle et les
    // cadrans d'un palier plus court (le desktop : A01 cede le temps du mode) ; sinon (le telephone) la colonne recule
    if (badge) {
      const plain = this.headPlan(false);
      for (const tier of DIAL_TIERS) {
        const groupLeft = right - g.width(tier);
        if (groupLeft - HEAD_COL.gap - badgeW - colW < plain.voiceX - 0.01) continue;
        plan = { tier, voiceX: plain.voiceX, colW, groupLeft };
        break;
      }
      if (plan) {
        this.headPlans.set(key, plan);
        return plan;
      }
    }
    // Le bord gauche le plus a gauche ou la voix peut se poser, les onglets serres au palier fit (le plus large des 16
    // ecrans des 8 voix ; sans voix, VOICE FX se serre plus)
    // Seulement les ecrans des pages de cet appareil (V.5.0 : TRIG, MOD, TEMPO et le MIXER sont au desktop ; le telephone
    // garde sa mesure d'avant, au pixel pres)
    const need = (fit: number): number =>
      Math.max(...INSTRUMENTS.flatMap((inst) => RYTM_SCREENS.filter((s) => isRytmPage(SCREEN_PAGE[s])).map((s) => this.headLeft(SCREEN_PAGE[s], s, inst, HEAD_FIT[fit], false).end + (fxScopeTabs(s) ? HEAD_COL.tabAir : HEAD_COL.air))));
    const fitMax = need(HEAD_FIT_MAX);
    for (const tier of DIAL_TIERS) {
      const groupLeft = right - g.width(tier);
      const voiceX = groupLeft - HEAD_COL.gap - badgeW - colW;
      plan = { tier, voiceX, colW, groupLeft };
      if (fitMax <= voiceX) break;
    }
    // Au telephone, sans A01 (relecture du 2026-10-22 : la voix collee aux cadrans, a 172.3, laissait a la zone de MASTER
    // 39 px sur VOICE et 28 sous DIST CHORUS DELAY REVERB, 48 avant les places fixes) : la colonne recule tant que les
    // onglets gardent leur corps (HEAD_FIT_PHONE, 159), l'air gagne revient a la zone de MASTER (zoneLeft) : 50 px et 37
    const p0 = plan as HeadPlan;
    if (this.mobile && !badge && !p0.tier.a01) {
      const left = Math.ceil(need(HEAD_FIT_PHONE) * 2) / 2;
      if (left < p0.voiceX) plan = { ...p0, voiceX: left };
    }
    const out = plan as HeadPlan;
    this.headPlans.set(key, out);
    return out;
  }

  /**
   * Le bord droit de MASTER et TEMPO (2026-10-19) : a gauche de la touche i ; au
   * telephone, avant sa zone (26 unites autour d'elle, au coin du verre quand
   * les blocs ont la leur, la vue PAGE) : rien de dessine n'y tombe.
   */
  private dialRight(paged: boolean): number {
    if (!this.mobile) return PAGE_HEAD.right;
    return (paged ? INFO_KEY.blocks.x : INFO_KEY.x) - INFO_KEY.hit.phone - 4;
  }

  /** Les sept barres du vumetre de MASTER (2026-10-19) : leur largeur, l'air entre elles, la plus basse et la plus haute. */
  private static readonly METER = { n: 7, bw: 2.2, gap: 1.2, h0: 3, h1: 11.5 } as const;

  /**
   * Les mesures de MASTER, TEMPO et du pattern (2026-10-19) ; fixed (la vue
   * PAGE, 2026-10-22, audit SB-13) : le tempo, le pattern et le nombre de MASTER
   * comptes a leur plus large (DIAL_REF), le groupe ne bouge plus quand le
   * tempo ou le niveau changent. width : la largeur du groupe a un palier.
   */
  private dialGeom(cur: number, fixed: boolean): DialGeom {
    const T = this.bt.head;
    const M = Screen.METER;
    const level = clamp01(mix.level);
    const db = encUnit('level', level);
    const sp = db.lastIndexOf(' ');
    const mNum = sp > 0 ? db.slice(0, sp) : db;
    const mUnit = sp > 0 ? db.slice(sp + 1) : '';
    const bpmV = Math.round(pattern.get().bpm);
    // Le TEMPO qui suit les platines (2026-10-27) : 124.0 SYNC
    const bpm = tempoSync.text(pattern.get().bpm);
    const tnw = Math.max(this.textWidth(bpm, T.num, 400), ...(fixed ? DIAL_REF.bpm.map((t) => this.textWidth(t, T.num, 400)) : []));
    const tuw = this.textWidth(tempoSync.unit(), T.bpm, 600, 0.8);
    const tw = tnw + 3 + tuw;
    const meterW = M.n * M.bw + (M.n - 1) * M.gap;
    const mnw = this.textWidth(mNum, T.num, 400);
    const muw = this.textWidth(mUnit, T.bpm, 600, 0.8);
    const mFull = meterW + 4 + Math.max(mnw, fixed ? this.textWidth(DIAL_REF.db, T.num, 400) : 0) + 3 + muw;
    const slot = slotName(cur);
    const aw = Math.max(this.textWidth(slot, T.num, 600, 0.6), fixed ? this.textWidth(DIAL_REF.slot, T.num, 600, 0.6) : 0);
    const width = (t: DialTier): number => tw + DIAL_GAP.gd + (t.full ? mFull : meterW) + (t.a01 ? DIAL_GAP.g + aw : 0);
    return { level, db, mNum, mUnit, bpmV, bpm, tw, tuw, meterW, mnw, muw, mFull, slot, aw, width };
  }

  /**
   * MASTER et TEMPO dans l'ecran (2026-10-19), sur la ligne de base y, alignes
   * a droite (dialRight), et le pattern a leur gauche : TEMPO, le nombre et BPM,
   * sa course de 100 a 150 sur un fin trait dessous ; MASTER, un vumetre de
   * sept barres (allumees jusqu'au niveau, la derniere a moitie) et son niveau
   * en dB ; cernes a peine sous la souris, en plein tant qu'on les tient. Le
   * groupe cede ce qu'il faut pour laisser need a sa gauche : d'abord le nombre
   * de MASTER, puis le pattern ; si meme le dernier palier ne le laisse pas,
   * bare (le moins qu'il faut, sans voix ALL sans PICK A VOICE). Leurs zones
   * (dialRects) : de haut en bas jusqu'a zoneY1, chacune jusqu'au milieu de
   * l'air qui les separe. Rend le bord gauche du groupe. fixed (la vue PAGE,
   * 2026-10-22, audit SB-13) : le palier de headPlan, le meme sur toutes les
   * pages ; readout : MASTER tenu dit son niveau en dB a la place du pattern ;
   * zoneLeft : au telephone sans A01, la zone de MASTER s'etend jusque-la.
   */
  private paintDials(y: number, need: number, zoneY1: number, now: number, cur: number, bare = need, fixed: { tier: DialTier; zoneLeft: number; readout: boolean } | null = null): number {
    const T = this.bt.head;
    const M = Screen.METER;
    const paged = zoneY1 === PAGE_HEAD.rule;
    const right = this.dialRight(paged);
    const g = this.dialGeom(cur, !!fixed);
    const { level, db, mNum, mUnit, bpmV, bpm, tw, tuw, meterW, mnw, muw, mFull, slot, aw } = g;
    const G = DIAL_GAP.g;
    const GD = DIAL_GAP.gd;
    const fit = (n: number): DialTier | undefined => DIAL_TIERS.find((t) => right - g.width(t) >= n + 5);
    // La place laissee a gauche : need, sinon bare (relecture du 2026-10-19 : sans voix sur la page d'un FX, A01 cedait
    // pour un PICK A VOICE qui ne tenait de toute facon pas)
    const room = fit(need) || bare >= need ? need : bare;
    const tier = fixed ? fixed.tier : (fit(room) ?? DIAL_TIERS[DIAL_TIERS.length - 1]);
    const ds = screenDials.get();
    const ring = (id: ScreenDialId, x0: number, x1: number): void => {
      const held = ds.held === id;
      if (!held && ds.hover !== id) return;
      this.roundRect(x0 - 3.5, y - 13.8, x1 - x0 + 7, 19.6, 3, held ? 'rgba(246, 241, 231, 0.07)' : HOVER_FILL, held ? INK : HALF, held ? 1.3 : 0.9);
    };
    // TEMPO : le nombre, BPM, sa course dessous
    const tx1 = right;
    const tx0 = right - tw;
    ring('tempo', tx0, tx1);
    this.text(tempoSync.unit(), tx1, y, T.bpm, HALF, 600, 'right', 0.8);
    this.text(bpm, tx1 - tuw - 3, y, T.num, INK, 400, 'right');
    const gy = y + 3.4;
    const course = clamp01((bpmV - 100) / 50);
    this.line([tx0, gy, tx1, gy], FAINT, 1.1);
    this.line([tx0, gy, tx0 + (tx1 - tx0) * course, gy], INK, 1.6);
    this.circle(tx0 + (tx1 - tx0) * course, gy, 1.35, INK);
    // MASTER : le vumetre, et son niveau quand la place le permet
    const mx1 = tx0 - GD;
    const mx0 = mx1 - (tier.full ? mFull : meterW);
    ring('level', mx0, mx1);
    const lit = level * M.n;
    for (let k = 0; k < M.n; k += 1) {
      const h = M.h0 + ((M.h1 - M.h0) * k) / (M.n - 1);
      this.ctx.fillStyle = k + 1 <= lit + 1e-6 ? INK : k < lit ? HALF : FAINT;
      this.ctx.fillRect(mx0 + k * (M.bw + M.gap), y - h, M.bw, h);
    }
    if (tier.full) {
      this.text(mUnit, mx1, y, T.bpm, HALF, 600, 'right', 0.8);
      this.text(mNum, mx1 - muw - 3, y, T.num, INK, 400, 'right');
    }
    let left = mx0;
    const readout = !!fixed && fixed.readout && !tier.full;
    if (readout) {
      // MASTER tenu (2026-10-22) : son niveau en dB devant le vumetre, a la place du pattern et de la voix, le temps du geste
      this.text(mUnit, mx0 - G, y, T.bpm, HALF, 600, 'right', 0.8);
      this.text(mNum, mx0 - G - muw - 3, y, T.num, INK, 400, 'right');
      left = mx0 - G - muw - 3 - mnw;
    } else if (tier.a01) {
      // Le pattern (il clignote quand il change)
      const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
      this.text(slot, mx0 - G, y, T.num, blinkOff ? FAINT : INK, 600, 'right', 0.6);
      left = mx0 - G - aw;
    }
    // Les zones : jusqu'au milieu de l'air qui les separe, toute la hauteur de l'en-tete
    const mid = (mx1 + tx0) / 2;
    const lim = this.mobile ? right + 3 : UW;
    // Au telephone, dans la vue PAGE, sans A01 ni dB (VOICE, SYNTH, les pages d'un FX ; relecture du 2026-10-19 : 26 x 19 px
    // a 375 de large) : la zone de MASTER prend l'air libre a sa gauche, jusqu'a room + 5 (lcd-open n'y ouvre plus les
    // presets) ; Math.min garde l'ancien bord quand meme le dernier palier ne tient pas. HOME garde la sienne. Depuis le
    // 2026-10-22 (places fixes) : jusqu'a zoneLeft, apres la voix.
    const mz0 = this.mobile && paged && !tier.a01 ? Math.min(mx0 - 3, fixed ? fixed.zoneLeft : room + 5) : mx0 - 3;
    const up = this.headUp;
    this.dialRects.push({ id: 'lcd-master', ...this.spot({ x: mz0, y: -up, w: mid - mz0, h: zoneY1 + up }) });
    this.dialRects.push({ id: 'lcd-tempo', ...this.spot({ x: mid, y: -up, w: Math.min(tx1 + 4, lim) - mid, h: zoneY1 + up }) });
    // INFOS : la commande dont la carte est montree, ses quatre coins
    const di = this.infoDial();
    if (di) this.cornerMarks(di === 'level' ? mx0 - 3.5 : tx0 - 3.5, y - 15.5, di === 'level' ? mx1 + 3.5 : tx1 + 3.5, y + 7.4);
    const mark = (id: ScreenDialId): string => (ds.held === id ? '*' : ds.hover === id ? '~' : '');
    this.info.dials = `MASTER ${tier.full || readout ? db : `${Math.min(M.n, Math.floor(lit + 1e-6))}/${M.n}`}${mark('level')} | TEMPO ${bpm} BPM${mark('tempo')}`;
    this.info.dialSlot = tier.a01 && !readout ? slot : '';
    return left;
  }

  /**
   * La bande du haut de HOME (2026-10-19), au-dessus de son dessin de 120 : la
   * lecture a gauche, comme l'en-tete de la vue PAGE ; a droite le pattern,
   * MASTER et TEMPO, a la meme place que dans la vue PAGE. Au telephone, leurs
   * zones descendent dans l'air libre jusqu'au-dessus des cartes (CARD.y0, a
   * 4 pres) : 40 px de haut a 390 de large au lieu de 22, le doigt ne tombe pas
   * sur lcd-open (les presets) juste sous elles.
   */
  private paintHomeHead(cur: number, now: number, preset: LcdState['preset'] = null): void {
    if (DY < 12) return;
    this.runIcon(PAGE_HEAD.iconX, PAGE_HEAD.y);
    const left = this.paintDials(PAGE_HEAD.y, PAGE_HEAD.iconX + 14, this.mobile ? DY + CARD.y0 - 4 : DY + 6, now, cur);
    // FILL tenu (V.5.1, tenir YES) : sa pastille pleine juste apres la lecture, le preset charge passe apres elle
    let fx0 = PAGE_HEAD.iconX + 14;
    if (DT_FACE && fill.on) {
      const ts = this.bt.head.sound;
      const ph = this.bt.head.pillH;
      const w = this.textWidth('FILL', ts, 800, 0.6) + 8;
      if (left - 8 - fx0 >= w) {
        const py = PAGE_HEAD.pillY;
        this.roundRect(fx0, py, w, ph, 2.2, INK);
        this.text('FILL', fx0 + w / 2, py + ph / 2 + ts * 0.36, ts, BLACK, 800, 'center', 0.6);
        this.info.head = 'FILL';
        fx0 += w + 6;
      }
    }
    // Le preset charge (2026-10-27) : dans l'air entre la lecture et le pattern, une etoile s'il a bouge ; il cede sa
    // place (coupe d'un point, ou rien sous 30 unites), jamais le pattern, MASTER ni TEMPO
    if (preset) {
      const x0 = fx0;
      const room = left - 8 - x0;
      if (room >= 30) {
        const label = this.fitText(`${preset.label}${preset.edited ? '*' : ''}`, room, 8.5, 0.6, 600);
        this.text(label, x0, PAGE_HEAD.y - 0.5, 8.5, HALF, 600, 'left', 0.6);
        this.info.presetHead = label;
      }
    }
  }

  /** La commande de l'ecran dont la carte INFOS est montree (lcd-master, lcd-tempo), null aucune. */
  private infoDial(): ScreenDialId | null {
    const s = rytmInfos.get();
    if (!s.on || !s.id) return null;
    return s.id === 'lcd-master' ? 'level' : s.id === 'lcd-tempo' ? 'tempo' : null;
  }

  /** Quatre coins autour d'un rectangle (INFOS) : la carte parle de ce qu'il entoure. */
  private cornerMarks(x0: number, y0: number, x1: number, y1: number): void {
    const a = 4;
    const lw = this.mobile ? 1.4 : 1.1;
    this.line([x0, y0 + a, x0, y0, x0 + a, y0], INK, lw);
    this.line([x1 - a, y0, x1, y0, x1, y0 + a], INK, lw);
    this.line([x1, y1 - a, x1, y1, x1 - a, y1], INK, lw);
    this.line([x0 + a, y1, x0, y1, x0, y1 - a], INK, lw);
  }

  /**
   * La touche i (R4) : un cercle, le i dedans ; INFOS allume, le disque plein
   * et le i en noir ; sur l'en-tete negatif du P-LOCK, en noir sur l'os.
   */
  private paintInfoKey(on: boolean, neg = false): void {
    const c = this.ctx;
    const { x, y } = INFO_KEY;
    const r = this.mobile ? INFO_KEY.r.phone : INFO_KEY.r.desk;
    const fg = neg ? BLACK : INK;
    const bg = neg ? INK : BLACK;
    this.circle(x, y, r, on ? fg : bg, on ? null : fg, 0.95);
    const ink = on ? bg : fg;
    this.circle(x, y - r * 0.46, r * 0.15, ink);
    c.fillStyle = ink;
    const w = r * 0.26;
    c.fillRect(x - w / 2, y - r * 0.16, w, r * 0.68);
    this.info.infos = on;
  }

  /** Le bloc dont la carte INFOS est montree (penc-<k>, ou son bloc lcd-blk-<k>), -1 aucun. */
  private infoKnob(): number {
    const s = rytmInfos.get();
    if (!s.on || !s.id) return -1;
    const m = /^lcd-blk-([0-9]+)$/.exec(s.id);
    if (m) return Number(m[1]);
    // Un potard de la face du desktop (2026-10-27) : le bloc qu'il tourne
    if (FACE_PAGES && s.id.startsWith('penc-')) {
      const p = /^p:([0-7])$/.exec(rytmInfoHit(s.id)?.id ?? '');
      return p ? Number(p[1]) : -1;
    }
    return -1;
  }

  /** Quatre coins autour d'un bloc (INFOS, R4) : la carte parle de lui ; dehors, sans toucher au bloc ni a son echo. */
  private infoMarks(cell: SlotCell, k: number): void {
    const R = cellRect(cell);
    const x0 = R.x - 1.8;
    const y0 = R.y - 1.8;
    const x1 = R.x + R.w + 1.8;
    const y1 = R.y + R.h + 1.8;
    const a = 5;
    const lw = this.mobile ? 1.4 : 1.1;
    this.line([x0, y0 + a, x0, y0, x0 + a, y0], INK, lw);
    this.line([x1 - a, y0, x1, y0, x1, y0 + a], INK, lw);
    this.line([x1, y1 - a, x1, y1, x1 - a, y1], INK, lw);
    this.line([x0 + a, y1, x0, y1, x0, y1 - a], INK, lw);
    this.info.infoBlock = k;
  }

  /** Les blocs de l'ecran dans leurs cases ; les dessins (l'enveloppe, le filtre) a leur place. */
  private paintMatrix(blocks: readonly Block[], inst: Inst | null, mode: BlockMode | null): void {
    const c = this.ctx;
    for (const b of blocks) {
      if (b.state === 'empty') continue;
      if (b.graph) this.paintGraph(b, inst, mode);
      else this.paintBlock(b);
      this.pal = PAL;
      c.globalAlpha = 1;
    }
  }

  /**
   * Un bloc de la vue PAGE, dans sa case (une, deux de large, deux de haut).
   * En negatif (2026-10-08) : son verrou sur le pas en P-LOCK, ou celui du pas
   * qui joue, avec le coin P (2026-10-09) ; en retrait : la valeur de la voix
   * en P-LOCK (base), a peine : GLOBAL. La souris dessus (desktop, 2026-10-09) :
   * un cadre un peu plus marque ; tenu ou tourne : le contour plein (l'echo).
   */
  private paintBlock(b: Block): void {
    const c = this.ctx;
    const M = MATRIX;
    const R = cellRect(b.cell);
    const bx = R.x;
    const by = R.y;
    const bw = R.w;
    const bh = R.h;
    const B = BLOCK;
    const alive = b.state === 'live';
    const neg = alive && (b.lock === 'locked' || b.flash);
    const alpha = b.lock === 'base' ? (b.quiet ? 0.4 : 0.6) : b.lock === 'global' || b.lock === 'nolock' ? 0.32 : b.quiet ? 0.42 : 1;
    if (neg) {
      this.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, M.r, INK);
      if (b.echo) this.roundRect(bx - 1, by - 1, bw + 2, bh + 2, M.r + 1.2, null, INK, 0.9);
      // Le coin P (2026-10-09) : ce bloc porte un verrou sur ce pas
      const k = TALL ? 11 : 9;
      c.beginPath();
      c.moveTo(bx + bw - k - 0.5, by + 0.5);
      c.lineTo(bx + bw - 0.5 - M.r * 0.4, by + 0.5);
      c.quadraticCurveTo(bx + bw - 0.5, by + 0.5, bx + bw - 0.5, by + 0.5 + M.r * 0.4);
      c.lineTo(bx + bw - 0.5, by + k + 0.5);
      c.closePath();
      c.fillStyle = BLACK;
      c.fill();
      this.text(b.corner ?? 'P', bx + bw - 1.6, by + k * 0.52, k * 0.55, INK, 800, 'right');
    } else {
      c.globalAlpha = b.echo || b.hover ? 1 : alpha;
      if (b.hover && !b.echo) this.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, M.r, HOVER_FILL, HALF, 0.8);
      else this.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, M.r, null, b.echo ? INK : alive ? FRAME : FRAME_DIM, b.echo ? 1.2 : 0.7);
      // Un reglage qui se morphe (P2-20) : son coin A, B ou AB, en clair (la valeur est ce qui joue au crossfader)
      if (b.morph && alive) {
        const k = TALL ? 11 : 9;
        this.text(b.morph, bx + bw - 1.6, by + k * 0.52, k * 0.55, HALF, 800, 'right');
      }
    }
    this.pal = neg ? PAL_NEG : PAL;
    c.globalAlpha = neg ? 1 : alpha;
    const P = this.pal;
    const T = this.bt;
    const wide = b.cell.w > 1;
    const tall = b.cell.h > 1;
    // L'etiquette (BOTH, MACHINE, NO BD, ALL, la voix, STEP) : une seule place par ecran (revue du 2026-10-09 : elle sautait
    // de la ligne du nom a celle de l'unite d'un bloc a l'autre, et l'unite rognee pour elle se lisait 5. ou H.) : au desktop
    // a droite du nom ; au telephone au bout de la ligne d'unite (le nom y prend la largeur), sans celles que l'en-tete dit
    // deja (MACHINE : l'onglet SYNTH ; ALL : GLOBAL ; la voix : BD FX). Elle s'efface plutot que de couper l'unite. En
    // P-LOCK, un bloc qu'on ne verrouille pas dit GLOBAL ou NO LOCK a la place de son unite.
    const muted = b.lock === 'global' || b.lock === 'nolock';
    const onName = T.tagAt === 'name';
    const tag = muted || !b.tag || (!onName && b.tagHeader) ? '' : b.tag;
    const tagColor = b.noBd || b.all ? P.faintText : P.half;
    const tagSp = onName ? 0.5 : 0.2;
    const tagW = (t: string): number => this.textWidth(t, T.tagSize, 700, tagSp);
    const cornerW = neg || (b.morph && alive) ? (TALL ? 12 : 10) : 0;
    const nameRoom = bw - 2 * B.padX - cornerW;
    const nameW = this.textWidth(b.label, T.nameSize, 700, 0.7);
    const nameTag = tag && onName && nameW + tagW(tag) + 5 <= nameRoom ? tag : '';
    const ntw = nameTag ? tagW(nameTag) + 5 : 0;
    // Un nom qui ne tient pas (2026-10-10, FEEDBACK de la page DELAY au telephone : FEEDBA.) : un corps plus petit avant de le couper
    const nameSize = nameW <= nameRoom - ntw ? T.nameSize : ([0.9, 0.82].map((f) => T.nameSize * f).find((s) => this.textWidth(b.label, s, 700, 0.7) <= nameRoom - ntw) ?? T.nameSize);
    this.text(this.fitText(b.label, nameRoom - ntw, nameSize, 0.7, 700), bx + B.padX, by + T.nameDy, nameSize, alive ? P.half : P.faint, 700, 'left', 0.7);
    if (nameTag) this.text(nameTag, bx + bw - B.padX - cornerW, by + T.nameDy, T.tagSize, tagColor, 700, 'right', tagSp);
    if (!alive) {
      // Une voix a un seul son (CY) : son nom quand meme, a peine
      const t = b.text && b.text !== '--' ? b.text : '--';
      this.text(this.fitText(t, bw - 2 * B.padX, T.valueSizes[1], 0, 300), bx + B.padX, by + T.valueDy, T.valueSizes[1], P.faint, 300);
      // Sa forme courte quand l'unite ne tient pas (2026-10-22, revue INT-4 : PICK A VOI. dans PITCH et FINE)
      const offUnit = b.unit && b.unitShort && this.textWidth(b.unit, T.unitSize, 600, 0.4) > bw - 2 * B.padX ? b.unitShort : b.unit;
      if (offUnit) this.text(this.fitText(offUnit, bw - 2 * B.padX, T.unitSize), bx + B.padX, by + T.unitDy, T.unitSize, P.faint, 600, 'left', 0.4);
      this.info.tags.push(`${b.label}:${b.unit}|${nameTag ? `${nameTag}@name` : ''}`);
      return;
    }
    // La place de l'image : a droite pour un bloc simple ; un grand bloc (SOUND) garde la largeur au nom du son ; un bloc
    // haut l'a sous l'unite, sa valeur prend la largeur
    // Au desktop (2026-10-27, la face : le bloc k au-dessus du potard k) SOUND, MIX et COMP tiennent sur une seule case :
    // leur dessin passe en bande au pied du bloc, sous la ligne d'unite (strip) ; SOUND et MIX y prennent toute la largeur
    // pour leur valeur (faceText : le nom du son, le melange), COMP garde son potard a droite
    const strip = FACE_PAGES && !tall && !wide && (b.draw === 'sound' || b.draw === 'mix' || b.draw === 'gr');
    const faceText = strip && b.draw !== 'gr';
    const under = tall || faceText;
    const drawW = under ? 0 : wide ? Math.min(54, bw * 0.34) : bw - B.draw.dx0 + 1;
    // COND (V.5.1) aussi : sa valeur (1:2, !FILL, NONE) prend toute la largeur, son dessin le bout de la ligne d'unite
    const stepped = b.draw === 'notch' || b.draw === 'ftype' || b.draw === 'time' || b.draw === 'cond';
    const valueRoom = muted || stepped || under ? bw - 2 * B.padX : wide ? bw - 2 * B.padX - drawW - 4 : B.valueW;
    // Une seule case (la face, 2026-10-27) : le nom d'un son ou le melange se serre encore un peu avant d'etre coupe
    const v = this.fitValue(b.text, valueRoom, wide ? 1 : 0, tall ? TALL_VALUE : 1, faceText ? FACE_TEXT_SIZES : []);
    // Un bloc haut : la valeur plus grosse descend d'autant, l'unite la suit
    const drop = tall ? T.valueSizes[0] * (TALL_VALUE - 1) * 0.72 + 2 : 0;
    const valueY = by + T.valueDy + drop;
    if (v.text.includes('/')) this.slashText(v.text, bx + B.padX, valueY, v.size, P.ink, neg ? 400 : 300);
    else this.text(v.text, bx + B.padX, valueY, v.size, P.ink, neg ? 400 : 300);
    const unitY = by + T.unitDy + drop;
    // Au desktop, les crans d'un reglage a crans tiennent le bout de la ligne d'unite
    const notchW = T.notchRow && stepped && !wide && !muted ? 24 : 0;
    // Un grand carre (2 x 2, la quantite d'un FX) : son potard tient la droite du bloc, la ligne d'unite et son etiquette
    // s'arretent avant lui (2026-10-10, le telephone : NO BD se posait sur l'arc de DELAY)
    const arcX = tall && wide && (b.draw === 'bar' || b.draw === 'barc') ? Math.max(bx + bw * 0.44, bx + B.padX + this.textWidth('127', v.size, 300) + 6) : 0;
    const unitRight = arcX > 0 ? arcX - 4 : bx + bw - B.padX - notchW;
    const room = unitRight - (bx + B.padX);
    if (muted) {
      this.text(this.fitText(b.tag, room, T.unitSize, 0.5, 700), bx + B.padX, unitY, T.unitSize, P.half, 700, 'left', 0.5);
      this.info.tags.push(`${b.label}:${b.tag}|`);
      return;
    }
    const uw = (u: string): number => this.textWidth(u, T.unitSize, 600, 0.4);
    let tail = onName ? '' : tag;
    const tailW = tail ? tagW(tail) + 3 : 0;
    let unit = b.unit;
    // Une seule case (la face, 2026-10-27 : SAMPLE 3 / 13, SYN 0 SMP 127) : l'unite entiere un peu plus petite, avant sa forme courte
    const uFit = faceText && unit && uw(unit) > room - tailW ? FACE_UNIT_SHRINK.map((f) => T.unitSize * f).find((z) => this.textWidth(unit, z, 600, 0.4) <= room - tailW) : undefined;
    const unitSize = uFit ?? T.unitSize;
    if (unit && unitSize === T.unitSize && uw(unit) > room - tailW) {
      // La forme courte de l'unite (NEW STEPS HIGH : NEW: HIGH) ; sinon l'unite entiere d'abord, l'etiquette s'efface
      if (b.unitShort && uw(b.unitShort) <= room - tailW) unit = b.unitShort;
      else {
        tail = '';
        if (b.unitShort && uw(unit) > room) unit = b.unitShort;
      }
    }
    if (tail) this.text(tail, unitRight, unitY, T.tagSize, tagColor, 700, 'right', tagSp);
    const u = unit ? this.fitText(unit, room - (tail ? tailW : 0), unitSize) : '';
    if (u) this.text(u, bx + B.padX, unitY, unitSize, P.half, 600, 'left', 0.4);
    this.info.tags.push(`${b.label}:${u}|${nameTag ? `${nameTag}@name` : tail ? `${tail}@unit` : ''}`);
    // L'image : un grand bloc (deux de haut) sous l'unite, sur toute sa largeur ; sinon a droite de la valeur
    let r: Rect;
    if (tall) {
      const top = unitY + (TALL ? 8 : 6);
      r = { x0: bx + B.padX + 2, y0: top, x1: bx + bw - B.padX - 2, y1: by + bh - (TALL ? 7 : 5) };
    } else if (wide) r = { x0: bx + bw - B.padX - drawW, y0: by + B.draw.dy0, x1: bx + bw - B.padX, y1: by + B.draw.dy1 };
    else r = { x0: bx + B.draw.dx0, y0: by + B.draw.dy0, x1: bx + B.draw.dx1, y1: by + B.draw.dy1 };
    if (strip) {
      // La bande du pied (2026-10-27) : de la ligne d'unite au bas du bloc, cinq unites
      const sr: Rect = { x0: bx + B.padX, y0: by + bh - FACE_STRIP.up, x1: bx + bw - B.padX, y1: by + bh - FACE_STRIP.down };
      if (b.draw === 'sound') this.drawSoundStrip(sr, b.notches, b.value);
      else if (b.draw === 'mix') this.drawMixStrip(sr, b.course, !b.quiet);
      else {
        this.drawArc(r, b.course, b.bipolar);
        this.drawGrStrip(sr, b.course);
      }
      return;
    }
    if (stepped) {
      // Un reglage a crans : au desktop ses crans au bout de la ligne du nom de valeur ; au telephone rien (la valeur le dit)
      if (!T.notchRow && !wide) return;
      const nr: Rect = wide ? r : { x0: bx + bw - B.padX - 22, y0: unitY - 4, x1: bx + bw - B.padX - 1, y1: unitY };
      if (b.draw === 'ftype') this.drawFtype(wide ? r : { x0: bx + B.draw.dx0 - 2, y0: by + B.draw.dy0, x1: bx + B.draw.dx1, y1: by + B.draw.dy1 }, b.value);
      else if (b.draw === 'cond') this.drawCond(nr, Math.round(b.value));
      else if (b.notches === 2) this.drawSwitch({ x0: nr.x1 - 13, y0: nr.y0 - 1.5, x1: nr.x1, y1: nr.y1 + 0.5 }, b.course >= 0.5);
      else this.drawNotch(nr, b.notches, b.course);
      return;
    }
    switch (b.draw) {
      case 'level':
        this.drawLevel(r, b.course);
        break;
      case 'tone':
        this.drawTone(r, b.value);
        break;
      case 'decay':
        this.drawDecay(r, b.course);
        break;
      case 'swing':
        this.drawSwing(r, b.value);
        break;
      case 'stretch':
        this.drawStretch(r, b.value);
        break;
      case 'start':
        this.drawStart(r, b.course);
        break;
      case 'sound':
        this.drawSoundList(r, b.notches, b.value);
        break;
      case 'mix':
        this.drawMix(r, b.course, !b.quiet);
        break;
      case 'atk':
        this.drawAtk(r, b.course);
        break;
      case 'hold':
        this.drawHold(r, b.course);
        break;
      case 'cut':
        this.drawCut(r, b.course);
        break;
      case 'reso':
        this.drawReso(r, b.course);
        break;
      case 'gr':
        this.drawGr(r, b.course, T.tagSize);
        break;
      // V.5.1 (2026-10-29, TRIG et MOD) : la condition, la vitesse du retrig, la velocite des repetitions, la forme du LFO
      case 'rate':
        this.drawRate(r, Math.round(b.value));
        break;
      case 'vfad':
        this.drawVfad(r, b.value);
        break;
      case 'wave':
        this.drawWave(r, Math.round(b.value));
        break;
      default:
        // Un grand carre (2 x 2, la quantite d'un FX sur sa page, 2026-10-10) : le potard a droite de la valeur, sur toute la
        // hauteur du bloc (sous l'unite, il restait petit au milieu d'un grand vide) ; jamais sur la valeur la plus large (127)
        if (tall && wide) this.drawBigArc({ x0: arcX, y0: by + T.nameDy + 4, x1: bx + bw - B.padX - 2, y1: by + bh - (TALL ? 7 : 5) }, b.course, b.draw === 'barc' || b.bipolar);
        else if (tall) this.drawBigArc(r, b.course, b.draw === 'barc' || b.bipolar);
        else this.drawArc(r, b.course, b.draw === 'barc' || b.bipolar);
    }
  }

  /**
   * COMP sur sa page (2026-10-18) : son potard (le MIX) en haut, l'aiguille de sa reduction dessous, une barre qui part
   * de la droite (0 dB) vers la gauche (24 dB), en racine (3 dB se voient), reperes a 3, 6 et 12 dB ; la reduction lue
   * par le port du worklet (audio/drums.ts compGr), la plus forte des 50 dernieres ms. COMP a 0 : la barre reste vide.
   */
  private drawGr(r: Rect, course: number, ts: number): void {
    const gr = course > 0 ? compGr() : 0;
    const barH = TALL ? 5 : 4;
    const rowH = ts + 3;
    const y1 = r.y1;
    const y0 = y1 - barH;
    if (r.y1 - r.y0 > barH + rowH + 12) this.drawBigArc({ x0: r.x0, y0: r.y0, x1: r.x1, y1: y0 - rowH - 2 }, course, false);
    const w = r.x1 - r.x0;
    const at = (db: number): number => r.x1 - w * Math.sqrt(Math.min(1, Math.max(0, db) / 24));
    this.roundRect(r.x0, y0, w, barH, 1.2, null, this.pal.faint, 0.7);
    if (gr > 0.05) this.roundRect(at(gr), y0, r.x1 - at(gr), barH, 1.2, this.pal.ink);
    for (const t of [3, 6, 12]) this.line([at(t), y0 - 1.5, at(t), y0], this.pal.half, 0.6);
    const ty = y0 - 2.5;
    this.text('GR', r.x0, ty, ts, this.pal.half, 700, 'left', 0.5);
    const word = gr > 0.05 ? `-${gr < 10 ? gr.toFixed(1) : Math.round(gr)} DB` : '0 DB';
    this.text(word, r.x1, ty, ts, gr > 0.05 ? this.pal.ink : this.pal.half, 700, 'right', 0.3);
    this.info.graph = `GR ${gr.toFixed(1)}`;
    // L'aiguille vit : une autre image dans 50 ms tant que le COMP joue (ou que sa reduction retombe)
    if ((course > 0 && clock.running) || gr > 0.05) this.meterLive = true;
  }

  /** SOUND (2026-10-09) : la liste en points, le son du moment plein ; trop de sons : une barre et son rang. */
  private drawSoundList(r: Rect, n: number, cur: number): void {
    if (n < 2) return;
    const y = (r.y0 + r.y1) / 2;
    if (n > 14) {
      this.drawBar(r, cur / (n - 1), false);
      return;
    }
    const step = (r.x1 - r.x0) / (n - 1);
    for (let i = 0; i < n; i += 1) {
      const x = r.x0 + i * step;
      // OFF, les machines, les samples : trois familles de points (un trait entre elles)
      if (i === Math.round(cur)) this.circle(x, y, TALL ? 2.6 : 2.2, this.pal.ink);
      else this.circle(x, y, i === 0 ? 0.7 : 1, i === 0 ? this.pal.faint : this.pal.half);
      if (i === 1 || i === 4) this.line([x - step / 2, y - 3.2, x - step / 2, y + 3.2], this.pal.faint, 0.6);
    }
  }

  /** SOUND sur une seule case du desktop (2026-10-27) : la rangee de points de la liste en bande, ou sa barre au-dela de 14 sons. */
  private drawSoundStrip(r: Rect, n: number, cur: number): void {
    if (n < 2) return;
    if (n > 14) {
      this.drawBar(r, cur / (n - 1), false);
      return;
    }
    const y = (r.y0 + r.y1) / 2;
    const step = (r.x1 - r.x0) / (n - 1);
    for (let i = 0; i < n; i += 1) {
      const x = r.x0 + i * step;
      if (i === Math.round(cur)) this.circle(x, y, 2, this.pal.ink);
      else this.circle(x, y, i === 0 ? 0.7 : 0.95, i === 0 ? this.pal.faint : this.pal.half);
      if (i === 1 || i === 4) this.line([x - step / 2, y - 2.2, x - step / 2, y + 2.2], this.pal.faint, 0.6);
    }
  }

  /** MIX sur une seule case du desktop (2026-10-27) : le rail en bande, son milieu, le curseur ; l'unite dit SYN et SMP. */
  private drawMixStrip(r: Rect, m: number, cursor = true): void {
    const y = (r.y0 + r.y1) / 2;
    const x = r.x0 + (r.x1 - r.x0) * clamp01(m);
    this.line([r.x0, y, r.x1, y], this.pal.faint, 1.4);
    this.line([(r.x0 + r.x1) / 2, y - 2.2, (r.x0 + r.x1) / 2, y + 2.2], this.pal.half, 0.7);
    if (cursor) this.roundRect(x - 1.6, r.y0, 3.2, r.y1 - r.y0, 0.8, this.pal.ink);
  }

  /** La reduction du COMP sur une seule case du desktop (2026-10-27) : la barre de drawGr en bande, de la droite (0 dB). */
  private drawGrStrip(r: Rect, course: number): void {
    const gr = course > 0 ? compGr() : 0;
    const w = r.x1 - r.x0;
    const at = (db: number): number => r.x1 - w * Math.sqrt(Math.min(1, Math.max(0, db) / 24));
    const h = r.y1 - r.y0 - 1;
    this.roundRect(r.x0, r.y0 + 0.5, w, h, 1, null, this.pal.faint, 0.7);
    if (gr > 0.05) this.roundRect(at(gr), r.y0 + 0.5, r.x1 - at(gr), h, 1, this.pal.ink);
    for (const t of [3, 6, 12]) this.line([at(t), r.y0 - 1, at(t), r.y0 + 0.5], this.pal.half, 0.6);
    this.info.graph = `GR ${gr.toFixed(1)}`;
    if ((course > 0 && clock.running) || gr > 0.05) this.meterLive = true;
  }

  /**
   * MIX (2026-10-09) : un crossfader, SYN a gauche, SMP a droite, le curseur ou
   * la part tombe ; la voix muette : pas de curseur. Les deux mots seulement
   * s'ils tiennent separes (revue : SYSMP).
   */
  private drawMix(r: Rect, m: number, cursor = true): void {
    const w = TALL ? 4.4 : 3.6;
    const h = TALL ? 9 : 7.5;
    // Le rail au bas de la place, les mots au-dessus : le curseur a un bout ne touche pas SMP
    const y = r.y1 - h / 2;
    const x = r.x0 + (r.x1 - r.x0) * clamp01(m);
    this.line([r.x0, y, r.x1, y], this.pal.faint, 1.4);
    this.line([(r.x0 + r.x1) / 2, y - 2.6, (r.x0 + r.x1) / 2, y + 2.6], this.pal.half, 0.7);
    if (cursor) this.roundRect(x - w / 2, y - h / 2, w, h, 1, this.pal.ink);
    // Au telephone a 9.8 (9 px a l'ecran, 69-common2 point 6)
    const ts = TALL ? 9.8 : 5.5;
    if (2 * this.textWidth('SYN', ts, 700, 0.3) + 6 > r.x1 - r.x0) return;
    this.text('SYN', r.x0, r.y0 + ts * 0.7, ts, this.pal.half, 700, 'left', 0.3);
    this.text('SMP', r.x1, r.y0 + ts * 0.7, ts, this.pal.half, 700, 'right', 0.3);
  }

  /** ATK (2026-10-09) : la rampe d'attaque, plus couchee avec la valeur, puis le plateau. */
  private drawAtk(r: Rect, course: number): void {
    const ax = r.x0 + (r.x1 - r.x0) * (0.06 + 0.78 * clamp01(course));
    this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
    this.line([r.x0, r.y1, ax, r.y0 + 1.5, r.x1, r.y0 + 1.5], this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
  }

  /** HOLD (2026-10-09) : la frappe, le plateau qui s'allonge, la chute. */
  private drawHold(r: Rect, course: number): void {
    const a = r.x0 + 2;
    const h = a + (r.x1 - r.x0 - 8) * (0.08 + 0.85 * clamp01(course));
    this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
    this.line([r.x0, r.y1, a, r.y0 + 1.5, h, r.y0 + 1.5, Math.min(r.x1, h + 5), r.y1], this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
  }

  /** FREQ (2026-10-09) : un passe-bas dont la coupure glisse avec la valeur. */
  private drawCut(r: Rect, course: number): void {
    const fc = r.x0 + (r.x1 - r.x0) * (0.1 + 0.8 * clamp01(course));
    const top = r.y0 + 3;
    const pts: number[] = [r.x0, top];
    const n = 24;
    for (let k = 0; k <= n; k += 1) {
      const x = r.x0 + ((r.x1 - r.x0) * k) / n;
      const d = Math.max(0, x - fc) / (r.x1 - r.x0);
      pts.push(x, Math.min(r.y1, top + d * d * 220 + (Math.abs(x - fc) < 2 ? -1.2 : 0)));
    }
    this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
  }

  /** RESO (2026-10-09) : la bosse du filtre a sa coupure, plus haute avec la valeur. */
  private drawReso(r: Rect, course: number): void {
    const mid = r.x0 + (r.x1 - r.x0) * 0.62;
    const base = r.y1 - (r.y1 - r.y0) * 0.35;
    const peak = (r.y1 - r.y0 - 2) * (0.1 + 0.9 * clamp01(course));
    const pts: number[] = [];
    const n = 28;
    for (let k = 0; k <= n; k += 1) {
      const x = r.x0 + ((r.x1 - r.x0) * k) / n;
      const t = (x - mid) / ((r.x1 - r.x0) * 0.16);
      const fall = x > mid ? Math.min(r.y1 - base, ((x - mid) / (r.x1 - r.x0)) * 60) : 0;
      pts.push(x, Math.min(r.y1, base - peak * Math.exp(-t * t) + fall));
    }
    this.line([r.x0, r.y1, r.x1, r.y1], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 1.6 * Math.max(0.7, Screen.cardK(r)));
  }

  /** TYPE (2026-10-09) : les trois formes LP, HP, BP en petit, celle du moment pleine. */
  private drawFtype(r: Rect, v: number): void {
    const i = Math.max(0, Math.min(2, Math.round(v * 2)));
    const cw = (r.x1 - r.x0) / 3;
    for (let k = 0; k < 3; k += 1) {
      const x0 = r.x0 + k * cw + 1;
      const x1 = x0 + cw - 2.5;
      const y0 = r.y0 + 3;
      const y1 = r.y1 - 1;
      const col = k === i ? this.pal.ink : this.pal.faint;
      const lw = k === i ? 1.5 : 1;
      const mx = (x0 + x1) / 2;
      if (k === 0) this.line([x0, y0, mx, y0, x1, y1], col, lw);
      else if (k === 1) this.line([x0, y1, mx, y0, x1, y0], col, lw);
      else this.line([x0, y1, mx, y0, x1, y1], col, lw);
    }
  }

  /** Un grand potard dessine (les FX de la voix, sur deux rangees, 2026-10-09) : le meme que drawArc, plus grand, la piste plus marquee. */
  private drawBigArc(r: Rect, course: number, centre: boolean): void {
    const side = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    this.drawArc({ x0: cx - side / 2, y0: cy - side / 2, x1: cx + side / 2, y1: cy + side / 2 }, course, centre, TALL ? 2.6 : 2.2);
  }

  /**
   * Les dessins d'un ecran (2026-10-09) : ENV (AMP ENV) l'enveloppe AHD du
   * coup, FLTR la courbe du filtre ; ceux de la voix, ou ceux du pas montre
   * (P-LOCK, le pas qui joue) avec ses verrous. Ni valeur ni zone : ils suivent
   * les blocs qu'on tourne, en direct.
   */
  private paintGraph(b: Block, inst: Inst | null, mode: BlockMode | null): void {
    const R = cellRect(b.cell);
    const M = MATRIX;
    const T = this.bt;
    const lk = inst && mode ? (mode.kind === 'lock' ? lockOf(pattern.get().locks, inst, mode.step) : mode.kind === 'flash' ? mode.lock : null) : null;
    const fx = inst ? voiceFx.of(inst) : null;
    const val = (k: 'atk' | 'hold' | 'decay' | 'ftype' | 'fcut' | 'freso' | 'fenv' | 'fatk' | 'fdec' | 'start'): number => (lk?.[k] ?? (fx ? fx[k] : 0)) as number;
    const locked = (keys: readonly string[]): boolean => !!lk && keys.some((k) => k in lk);
    this.roundRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, M.r, null, FRAME_DIM, 0.6);
    const pad = BLOCK.padX;
    const isAhd = b.graph === 'ahd';
    const hot = isAhd ? locked(['atk', 'hold', 'decay', 'start']) : locked(['ftype', 'fcut', 'freso', 'fenv', 'fatk', 'fdec']);
    const title = `${b.label}${hot ? (mode?.kind === 'lock' ? ' · P-LOCK' : ' · STEP') : ''}`;
    this.text(this.fitText(title, R.w - 2 * pad, T.nameSize, 0.7, 700), R.x + pad, R.y + T.nameDy, T.nameSize, hot ? INK : HALF, 700, 'left', 0.7);
    if (!fx) {
      this.text('PICK A VOICE', R.x + pad, R.y + T.valueDy, T.unitSize, FAINT_TEXT, 600);
      return;
    }
    const area: Rect = { x0: R.x + pad, y0: R.y + T.nameDy + (TALL ? 5 : 3.5), x1: R.x + R.w - pad, y1: R.y + R.h - (TALL ? 12 : 9) };
    if (isAhd) this.drawAhd(area, val('atk'), val('hold'), val('decay'), R.y + R.h - (TALL ? 3.6 : 2.6));
    else this.drawFilterGraph(area, val('ftype'), val('fcut'), val('freso'), val('fenv'), R.y + R.h - (TALL ? 3.6 : 2.6));
    this.info.graph = isAhd ? `AHD ${val('atk').toFixed(2)} ${val('hold').toFixed(2)} ${val('decay').toFixed(2)}` : `FILTER ${val('ftype')} ${val('fcut').toFixed(2)}`;
  }

  /** L'enveloppe AHD : l'attaque, la tenue, la descente (FULL : la queue entiere), ses trois temps dessous. */
  private drawAhd(r: Rect, atk: number, hold: number, decay: number, labelY: number): void {
    const a = atkS(atk);
    const h = holdS(hold);
    const tau = decayTau(decay);
    const d = tau === null ? Infinity : tau * Math.log(1000);
    // L'axe du temps : de quoi lire les trois parties (au moins 0.3 s), une queue entiere comptee 1.5 s
    const total = Math.max(0.3, a + h + (Number.isFinite(d) ? d : 1.5)) * 1.05;
    const X = (t: number): number => r.x0 + ((r.x1 - r.x0) * Math.min(total, t)) / total;
    const top = r.y0 + 2;
    const base = r.y1;
    this.line([r.x0, base, r.x1, base], FAINT, 0.7);
    const pts: number[] = [r.x0, base, X(a), top, X(a + h), top];
    const n = 36;
    for (let k = 1; k <= n; k += 1) {
      const t = (total - a - h) * (k / n);
      const y = tau === null ? top : base - (base - top) * Math.exp(-t / tau);
      pts.push(X(a + h + t), y);
    }
    // Le dessous de la courbe, a peine (le son), puis la courbe
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.lineTo(r.x1, base);
    c.closePath();
    c.fillStyle = 'rgba(246, 241, 231, 0.08)';
    c.fill();
    this.line(pts, INK, TALL ? 2 : 1.7);
    // Les reperes : la fin de l'attaque, de la tenue
    for (const t of [a, a + h]) this.line([X(t), base, X(t), base - 2.4], HALF, 0.8);
    const ls = TALL ? this.bt.unitSize : this.bt.unitSize * 0.92;
    const ms = (s: number): string => (s >= 1 ? `${s.toFixed(1)}S` : `${Math.round(s * 1000)}MS`);
    const parts = [`A ${a <= 0 ? 'SNAP' : ms(a)}`, `H ${ms(h)}`, `D ${Number.isFinite(d) ? ms(d) : 'FULL'}`];
    const cw = (r.x1 - r.x0) / 3;
    parts.forEach((p, i) => this.text(this.fitText(p, cw - 2, ls, 0.4, 700), r.x0 + i * cw, labelY, ls, HALF, 700, 'left', 0.4));
  }

  /** La courbe du filtre : son type a sa coupure, la bosse de la resonance, l'enveloppe en fantome (ou elle l'emmene). */
  private drawFilterGraph(r: Rect, type: number, cut: number, reso: number, env: number, labelY: number): void {
    const t = Math.max(0, Math.min(2, Math.round(type * 2)));
    const curve = (cc: number): number[] => {
      const fc = r.x0 + (r.x1 - r.x0) * clamp01(cc);
      const pk = (r.y1 - r.y0) * 0.5 * clamp01(reso);
      const mid = r.y0 + (r.y1 - r.y0) * 0.42;
      const pts: number[] = [];
      const n = 40;
      for (let k = 0; k <= n; k += 1) {
        const x = r.x0 + ((r.x1 - r.x0) * k) / n;
        const u = (x - fc) / (r.x1 - r.x0);
        const bump = pk * Math.exp(-(u * u) / 0.004);
        let y: number;
        if (t === 0) y = mid + (u > 0 ? u * u * 900 : 0) - bump;
        else if (t === 1) y = mid + (u < 0 ? u * u * 900 : 0) - bump;
        else y = mid + u * u * 700 - bump;
        pts.push(x, Math.max(r.y0, Math.min(r.y1, y)));
      }
      return pts;
    };
    this.line([r.x0, r.y1, r.x1, r.y1], FAINT, 0.7);
    if (env !== 0) {
      // Ou l'enveloppe l'emmene (FENV_OCT octaves au sommet, sur les dix octaves de l'axe)
      const to = clamp01(cut + (env * FENV_OCT) / 10);
      this.ctx.save();
      this.ctx.setLineDash([2, 2]);
      this.line(curve(to), HALF, 1);
      this.ctx.restore();
    }
    this.line(curve(cut), INK, TALL ? 2 : 1.7);
    const ls = TALL ? this.bt.unitSize : this.bt.unitSize * 0.92;
    const type3 = ['LP', 'HP', 'BP'][t];
    this.text(`${type3} ${hzShort(cutHz(cut))}`, r.x0, labelY, ls, HALF, 700, 'left', 0.4);
  }

  /** Deux couches (R3) : deux petites plaques decalees, l'une pleine ; x : le bord droit, y : la ligne du nom. */
  private layersGlyph(x: number, y: number, color: string): void {
    const w = 6.2;
    const h = 4.4;
    this.roundRect(x - w - 2.4, y - h - 3.6, w, h, 1, null, color, 0.9);
    this.roundRect(x - w, y - h - 1.2, w, h, 1, color);
  }

  /** Un interrupteur (un reglage a deux crans, GATE, REV) : une pastille, son bouton a gauche (OFF) ou plein a droite (ON). */
  private drawSwitch(r: Rect, on: boolean): void {
    const h = r.y1 - r.y0;
    const w = r.x1 - r.x0;
    this.pill(r.x0, r.y0, w, h, on ? this.pal.ink : null, on ? null : this.pal.half, 0.8);
    this.circle(on ? r.x1 - h / 2 : r.x0 + h / 2, r.y0 + h / 2, h / 2 - 1.2, on ? this.pal.bg : this.pal.half);
  }

  /**
   * Un petit potard dessine (les reglages sans image a eux) : la piste de
   * 270 deg a peine, l'arc de la valeur plein (depuis midi pour un reglage a
   * zero au centre), l'aiguille.
   */
  private drawArc(r: Rect, course: number, centre: boolean, lw = 1.8): void {
    const c = this.ctx;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2 + 0.5;
    const rad = Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2 - 0.5;
    const a0 = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const at = a0 + sweep * clamp01(course);
    const from = centre ? a0 + sweep / 2 : a0;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, rad, a0, a0 + sweep);
    c.strokeStyle = this.pal.faint;
    c.lineWidth = lw * 0.78;
    c.stroke();
    if (Math.abs(at - from) > 0.01) {
      c.beginPath();
      c.arc(cx, cy, rad, Math.min(from, at), Math.max(from, at));
      c.strokeStyle = this.pal.ink;
      c.lineWidth = lw;
      c.stroke();
    }
    this.line([cx + Math.cos(at) * rad * 0.25, cy + Math.sin(at) * rad * 0.25, cx + Math.cos(at) * rad * 0.85, cy + Math.sin(at) * rad * 0.85], this.pal.ink, lw * 0.72);
  }

  /**
   * Les seize pas de la voix choisie, en bas a gauche (sans voix : le plus
   * fort des voix, en demi-teinte) : plein et blanc fort, demi-teinte doux,
   * vide un cadre a peine ; le pas choisi : un point au-dessus. En lecture, la
   * tete : le pas qui joue s'allume en negatif ; un pas qui a des verrous : un
   * trait dessous ; le pas qui joue avec ses verrous (2026-10-09) : son trait
   * plein et plus epais, en meme temps que P-LOCK dans l'en-tete.
   */
  private paintStrip(inst: Inst | null, sel: number, lockStep = -1, flashStep = -1): void {
    const S = PAGE_STRIP;
    const steps = pattern.get().steps;
    const head = clock.running ? playhead.get() : -1;
    const mask = lockMask(pattern.get().locks, inst);
    let strip = '';
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const x = S.x0 + i * S.pitch;
      const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
      const bars = VEL_BARS[v];
      const locked = ((mask >> i) & 1) === 1;
      strip += i === lockStep ? '*' : locked ? (bars > 0 ? 'L' : 'l') : bars > 0 ? 'o' : '.';
      if (i === lockStep) this.roundRect(x - 1.7, S.y - 1.7, S.size + 3.4, S.size + 3.4, 1.4, null, INK, 1.1);
      if (locked && i !== head) {
        const ly = S.y + S.size + 2.4;
        this.line([x + 0.9, ly, x + S.size - 0.9, ly], bars > 0 ? INK : HALF, this.mobile ? 1.5 : 1.2);
      }
      if (i === head) {
        this.ctx.fillStyle = INK;
        this.ctx.fillRect(x - 0.9, S.y - 0.9, S.size + 1.8, S.size + 1.8);
        if (bars > 0) this.circle(x + S.size / 2, S.y + S.size / 2, 1.3, BLACK);
        this.line([x - 0.9, S.y + S.size + 2.6, x + S.size + 0.9, S.y + S.size + 2.6], INK, i === flashStep ? 2.6 : 1.6);
      } else if (bars > 0) {
        this.ctx.fillStyle = !inst ? HALF : bars >= 3 ? INK : bars === 2 ? 'rgba(246, 241, 231, 0.75)' : HALF;
        this.ctx.fillRect(x, S.y, S.size, S.size);
      } else this.roundRect(x + 0.4, S.y + 0.4, S.size - 0.8, S.size - 0.8, 0.6, null, i % 4 === 0 ? HALF : FAINT, 0.7);
      if (i === sel && inst && i !== lockStep) this.circle(x + S.size / 2, S.y - 2.6, this.bt.selR, INK);
    }
    this.info.strip = strip;
  }

  /**
   * Le pied de la vue PAGE, a droite des seize pas, le premier qui vaut :
   * en P-LOCK ses deux lignes (ce qui vient de se passer ou les verrous du
   * pas, puis le geste) ; sinon le message du moment, la piste qui joue (sa
   * barre cliquable), MUTE et SOLO, le pas verrouille qui joue, et sinon
   * l'aide : DRAG A VALUE (au desktop aussi : l'ecran est l'editeur, les
   * encodeurs sont les FX globaux).
   */
  private paintFoot(s: LcdState, screen: RytmScreenId, lockStep: number, now: number, flash: { step: number; lock: Readonly<StepLock> | null } | null): number {
    const F = PAGE_FOOT;
    const x0 = F.x0;
    const x1 = F.x1;
    const y = F.y;
    const fs = this.bt.foot;
    if (lockStep >= 0) {
      const lk = rytmLock.get();
      const held = !lk.latched;
      const used = held && lk.writes > lk.since;
      const names = lockSummary(lockStep);
      const s1 = TALL ? 10 : this.mobile ? 10 : fs - 1.2;
      // La seconde ligne a 10 au telephone (revue du 2026-10-09 : 9.2 faisait moins de 9 px)
      const s2 = TALL ? 10 : this.mobile ? 8.6 : 5.8;
      const full = `STEP ${two(lockStep + 1)}: ${names.join(' ')}`;
      const list = this.textWidth(full, s1, 600, 0.5) <= x1 - x0 ? full : `STEP ${two(lockStep + 1)}: ${names.length} P-LOCKS ON ${lockPages(lockStep).join(' ')}`;
      const top = s.l3 && !s.mix ? s.l3 : names.length > 0 ? list : `${TURN}: STEP ${two(lockStep + 1)} ONLY`;
      // 2026-10-22 (audit SB-08) : au desktop aussi, l'aide alterne si elle ne tient pas en entier (STEP: E. avant)
      // V.5.0 au desktop : CLEAR est FUNC + PLAY
      const both = DT_FACE ? '2X: UNLOCK  FUNC+PLAY: ALL  STEP: EXIT' : '2X: UNLOCK  CLEAR: ALL  STEP: EXIT';
      const alt = !held && (this.mobile || this.textWidth(both, s2, 700, 0.6) > x1 - x0);
      const phase = alt ? Math.floor(now / TIP_MS) % 2 : 0;
      const tip = used
        ? 'RELEASE: P-LOCK DONE'
        : held
          ? 'RELEASE: STAY IN P-LOCK'
          : !alt
            ? both
            : phase === 0
              ? DT_FACE
                ? '2X: UNLOCK  FUNC+PLAY: ALL'
                : '2X: UNLOCK  CLEAR: ALL'
              : `${this.mobile ? 'TAP' : 'CLICK'} STEP ${two(lockStep + 1)} AGAIN: EXIT`;
      const y1 = TALL || !this.mobile ? F.y1 : 108.7;
      const y2 = TALL || !this.mobile ? F.y2 : 118;
      const t1 = this.fitText(top, x1 - x0, s1, 0.5, 600);
      const t2 = this.fitText(tip, x1 - x0, s2, 0.6, 700);
      this.text(t1, x0, y1, s1, INK, 600, 'left', 0.5);
      this.text(t2, x0, y2, s2, HALF, 700, 'left', 0.6);
      this.info.foot = [t1, t2];
      return alt ? TIP_MS - (now % TIP_MS) + 1 : 0;
    }
    if (s.bar !== null) {
      const ts = fs - 1.5;
      const tw = this.text(fit(s.l2.trim(), this.mobile ? 10 : 14), x0, y, ts, HALF, 600, 'left', 0.5);
      const lw = this.text(s.l3, x0 + tw + 6, y, ts, INK, 600);
      const rw = this.text(s.r3, x1, y, ts, INK, 600, 'right');
      const a = x0 + tw + 6 + lw + 5;
      const b = x1 - rw - 5;
      if (b - a > 10) {
        const yb = y - 2.3;
        const v = Math.max(0, Math.min(1, s.bar));
        this.line([a, yb, b, yb], FAINT, 1.4);
        this.line([a, yb, a + (b - a) * v, yb], INK, 1.8);
        this.circle(a + (b - a) * v, yb, 2.4, INK);
        this.bar = { x0: a * TEX_K, x1: b * TEX_K, y0: (y - 12) * TEX_K, y1: (y + 6) * TEX_K };
      }
      return 0;
    }
    if (s.l3 && !s.mix) {
      const t = this.fitText(s.l3, x1 - x0, fs, 0.5, 600);
      this.text(t, x0, y, fs, INK, 600, 'left', 0.5);
      this.info.footText = t;
      return 0;
    }
    // MUTE et SOLO : sur deux lignes, le desktop aussi (revue du 2026-10-09 : sur une, MULTI MUTE n'avait pas la place de
    // dire MUTE: DONE)
    if (this.paintMode2(x0, x1)) return 0;
    const fl = flash ? lockList(flash.step, flash.lock) : [];
    if (flash && fl.length > 0) {
      const t = this.flashLine(flash.step, fl, x1 - x0, fs);
      this.text(t, x0, y, fs, INK, 600, 'left', 0.4);
      this.info.footText = t;
      return 0;
    }
    // L'aide (2026-10-09) : au telephone le geste des blocs et celui des verrous, sur deux lignes ; au desktop sur une
    // Le crossfader (2026-10-27, P2-20) : au desktop, des scenes dans le motif (ou le crossfader qui bouge), la seconde ligne
    // devient sa bande A [----|----] B
    if (TALL && !this.mobile && (anyScenes(pattern.scenes.get()) || sceneCtl.moving())) {
      const fitsA = (t: string): boolean => this.textWidth(t, fs - 1, 700, 0.5) <= x1 - x0;
      const aText = plockHints().find(fitsA) ?? plockHints()[2];
      const a = this.fitText(aText, x1 - x0, fs - 1, 0.5, 700);
      this.text(a, x0, F.y1, fs - 1, HALF, 700, 'left', 0.5);
      const b = this.paintXStrip(x0, x1, F.y2, fs - 0.5);
      this.info.footText = `${a} / ${b}`;
      return 0;
    }
    if (TALL) {
      // La premiere forme qui tient en entier (le telephone : la place d'une ligne)
      const fits = (s: string, size: number, sp: number): boolean => this.textWidth(s, size, 700, sp) <= x1 - x0;
      const aText = plockHints().find((s) => fits(s, fs - 1, 0.5)) ?? plockHints()[2];
      const a = this.fitText(aText, x1 - x0, fs - 1, 0.5, 700);
      // La touche de la page allumee encore : l'onglet suivant, nomme ; une page sans onglet : HOME (revue du 2026-10-09)
      const inst = pattern.get().instrument;
      const page = SCREEN_PAGE[screen];
      const tabs = screensOf(page, inst);
      const next = tabs.length > 1 ? tabWord(tabs[(tabs.indexOf(screen) + 1) % tabs.length], inst) : 'HOME';
      // GLOBAL FX et les pages de ses FX (2026-10-10) : une tape sur un FX ouvre sa page ; sur elle, le chemin du retour
      const pick = (...l: string[]): string => l.find((s) => fits(s, fs - 0.5, 0.6)) ?? l[l.length - 1];
      // La page d'un FX a deux onglets (2026-10-10) : GLOBAL ou la voix en haut, FX revient a l'onglet du mode
      const vt = fxVoiceTabLabel(inst);
      // L'ecran haut du desktop (2026-10-18) : le clic et Echap, comme le pied d'une ligne d'avant
      const tap = this.mobile ? 'TAP' : 'CLICK';
      const back = this.mobile ? 'FX: BACK' : 'FX OR ESC: BACK';
      // L'ecran intouchable du desktop (V.4.2) : ses onglets ne se cliquent plus (FX ramene GLOBAL FX, puis VOICE FX), la page
      // d'un FX s'ouvre a la tape de son potard
      const bText = !SCREEN_TOUCH && (fxScopeTabs(screen) || isFxDetail(screen))
        ? DT_FACE
          ? pick(screen.startsWith('fxv') ? 'FX OR NO: BACK TO VOICE FX' : 'NO: BACK TO SEND FX', 'NO: BACK')
          : pick(`FX: BACK TO ${screen.startsWith('fxv') ? 'VOICE' : 'GLOBAL'} FX · ESC`, back)
        : !SCREEN_TOUCH && screen === 'fxg'
          ? pick('CLICK A KNOB: ITS FX SETTINGS', 'CLICK A KNOB: SETTINGS')
          : fxScopeTabs(screen)
            ? pick(`${tap} GLOBAL OR ${vt} · ${back}`, `GLOBAL OR ${vt} · ${back}`, back)
            : isFxDetail(screen)
              ? // Des formes plus courtes (2026-10-22, audit SB-08 : ESC: BA. au desktop)
                pick(`${tap} GLOBAL OR FX: BACK TO GLOBAL FX`, `${tap} GLOBAL OR ${back}`, `GLOBAL OR ${back}`, back)
              : screen === 'fxg'
                ? pick(`${tap} A FX: ITS SETTINGS · NEVER P-LOCKED`, `${tap} A FX: ITS SETTINGS`)
                : `${pageKeyWord(page)} AGAIN: ${next}`;
      const b = this.fitText(bText, x1 - x0, fs - 0.5, 0.6, 700);
      this.text(a, x0, F.y1, fs - 1, HALF, 700, 'left', 0.5);
      this.text(b, x0, F.y2, fs - 0.5, HALF, 700, 'left', 0.6);
      this.info.footText = `${a} / ${b}`;
      return 0;
    }
    // GLOBAL FX et les pages de ses FX (2026-10-10) : au desktop, le clic qui ouvre une page, et le retour
    // La page d'un FX a deux onglets (2026-10-10) : ses onglets sont en haut, FX ou Echap ramenent l'onglet du mode
    const desk = fxScopeTabs(screen)
      ? `${TURN}  /  FX OR ESC: BACK`
      : isFxDetail(screen)
        ? `${TURN}  /  GLOBAL, FX OR ESC: BACK`
        : screen === 'fxg'
          ? SCREEN_TOUCH
            ? `${TURN}  /  CLICK A FX: ITS SETTINGS`
            : `${TURN}  /  CLICK IT: ITS SETTINGS`
          : `${TURN}  /  TURN A KNOB = GLOBAL FX`;
    const t = this.fitText(this.mobile ? `HOLD A STEP + ${TURN}: P-LOCK` : desk, x1 - x0, fs - 0.5, 0.5, 700);
    this.text(t, x0, y, fs - 0.5, HALF, 700, 'left', 0.5);
    this.info.footText = t;
    return 0;
  }

  /**
   * La bande du crossfader (2026-10-27, P2-20) : A a gauche, B a droite (REC A ou REC B, la scene armee, en plein), le
   * milieu marque, le curseur a x ; rend sa forme texte (A [----|----] B).
   */
  private paintXStrip(x0: number, x1: number, y: number, size: number): string {
    const w = sceneCtl.get().armed;
    const x = sceneCtl.x();
    const la = w === 'a' ? 'REC A' : 'A';
    const lb = w === 'b' ? 'REC B' : 'B';
    const wa = this.text(la, x0, y, size, w === 'a' ? INK : HALF, 700, 'left', 0.6);
    const wb = this.text(lb, x1, y, size, w === 'b' ? INK : HALF, 700, 'right', 0.6);
    const a = x0 + wa + 5;
    const b = x1 - wb - 5;
    if (b - a > 10) {
      const yb = y - size * 0.36;
      this.line([a, yb, b, yb], FAINT, 1.2);
      const m = (a + b) / 2;
      this.line([m, yb - 2.2, m, yb + 2.2], HALF, 1);
      const px = a + (b - a) * x;
      this.line([px, yb - 3.4, px, yb + 3.4], INK, 2.2);
    }
    this.xLive = true;
    this.info.xfade = `${la} ${x.toFixed(2)} ${lb}`;
    const n = 9;
    const at = Math.round(x * (n - 1));
    return `${la} [${Array.from({ length: n }, (_, i) => (i === at ? '|' : '-')).join('')}] ${lb}`;
  }

  /**
   * MUTE et SOLO sur deux lignes (l'ecran haut du telephone, 2026-10-09 ; le
   * desktop aussi depuis la revue du meme jour) : le mode et ses voix, puis le
   * geste ; aux corps du pied du P-LOCK.
   */
  private paintMode2(x0: number, x1: number): boolean {
    const m = modeLines();
    if (!m) return false;
    const F = PAGE_FOOT;
    const fs = this.bt.foot;
    const s1 = TALL ? fs : this.mobile ? 10 : fs - 1;
    const s2 = TALL ? fs - 0.5 : this.mobile ? 8.6 : 6;
    const y1 = TALL || !this.mobile ? F.y1 : 108.7;
    const y2 = TALL || !this.mobile ? F.y2 : 118;
    const a = this.fitText(m.left, x1 - x0, s1, 0.5, 700);
    const b = this.fitText(m.tip, x1 - x0, s2, 0.6, 700);
    this.text(a, x0, y1, s1, INK, 700, 'left', 0.5);
    this.text(b, x0, y2, s2, HALF, 700, 'left', 0.6);
    this.info.footText = `${a} / ${b}`;
    return true;
  }

  /**
   * Le popup d'un encodeur du desktop (2026-10-09, Mika : "en desktop ils ne
   * servent qu'a faire les modifs des FX globaux de la machine") : GLOBAL et
   * son nom, sa valeur de 0 a 127 en grand, son unite, sa course ; au-dessus
   * des blocs, la page ne change pas.
   */
  private paintPopup(id: EncId): void {
    const M = MATRIX;
    const k = GLOBAL_ENCODERS.indexOf(id);
    const name = k >= 0 ? GLOBAL_ENC_LABELS[k] : id.toUpperCase();
    const v = globalValueOf(id);
    const w = 168;
    const h = M.h + (TALL ? 10 : 6);
    const x = (UW - w) / 2;
    const y = (M.rows[0] + M.rows[1] + M.h - h) / 2;
    // Un vrai calque (2026-10-22, audit SB-12) : les blocs dessous s'assombrissent, plus de +63 ni de RIVE qui depassent
    this.ctx.fillStyle = 'rgba(5, 5, 6, 0.84)';
    this.ctx.fillRect(0, M.rows[0] - 2, UW, M.rows[1] + M.h + 4 - M.rows[0]);
    this.roundRect(x - 2, y - 2, w + 4, h + 4, M.r + 2, BLACK);
    this.roundRect(x, y, w, h, M.r + 1, BLACK, INK, 1.4);
    const T = this.bt;
    const pad = 9;
    this.text('GLOBAL', x + pad, y + T.nameDy + 1, T.nameSize * 0.9, HALF, 700, 'left', 0.9);
    const gw = this.textWidth('GLOBAL', T.nameSize * 0.9, 700, 0.9);
    this.text(name, x + pad + gw + 5, y + T.nameDy + 1, T.nameSize, INK, 800, 'left', 0.8);
    const big = T.valueSizes[0] * 1.15;
    const vy = y + h * 0.66;
    const vw = this.text(v.text, x + pad, vy, big, INK, 300);
    this.text(this.fitText(v.unit, w - 2 * pad - vw - 8, T.unitSize * 1.05, 0.4, 600), x + pad + vw + 6, vy, T.unitSize * 1.05, HALF, 600, 'left', 0.4);
    // La course, en bas : la barre de la valeur
    const by = y + h - (TALL ? 7 : 5.5);
    this.line([x + pad, by, x + w - pad, by], FAINT, 1.6);
    this.line([x + pad, by, x + pad + (w - 2 * pad) * clamp01(v.course), by], INK, 2.2);
    this.info.popup = `GLOBAL ${name} ${v.text} ${v.unit}`;
  }

  /** Les verrous du pas qui joue sur une ligne : autant qu'il en tient, puis combien il en reste (+2). */
  private flashLine(step: number, fl: readonly LockLine[], maxW: number, size: number): string {
    let t = `P-LOCK ${two(step + 1)}`;
    for (let i = 0; i < fl.length; i += 1) {
      const next = `${t}  ${fl[i].name} ${fl[i].text}`;
      const rest = i < fl.length - 1 ? `  +${fl.length - i - 1}` : '';
      if (this.textWidth(next + rest, size, 600, 0.4) > maxW) return `${t}  +${fl.length - i}`;
      t = next;
    }
    return t;
  }

  /** Coupe un texte a la largeur (unites) ; un point final quand ca deborde. */
  private fitText(s: string, maxW: number, size: number, spacing = 0.4, weight = 600): string {
    if (this.textWidth(s, size, weight, spacing) <= maxW) return s;
    let n = s.length - 1;
    while (n > 1 && this.textWidth(fit(s, n), size, weight, spacing) > maxW) n -= 1;
    return fit(s, n);
  }

  /** La valeur d'un bloc dans sa largeur : 16, sinon 13, 11 puis 9 et coupee ; up : un cran plus gros (le grand bloc SOUND). */
  private fitValue(s: string, maxW: number, up = 0, scale = 1, more: readonly number[] = []): { text: string; size: number } {
    const sizes = [...(up ? [this.bt.valueSizes[0] * 1.12, ...this.bt.valueSizes] : this.bt.valueSizes).map((x) => x * scale), ...more];
    for (const size of sizes) if (this.textWidth(s, size, 300) <= maxW) return { text: s, size };
    const size = sizes[sizes.length - 1];
    let n = s.length - 1;
    while (n > 1 && this.textWidth(fit(s, n), size, 300) > maxW) n -= 1;
    return { text: fit(s, n), size };
  }

  /** Fin d'un redessin : la texture part, les compteurs suivent. */
  private done(s: LcdState, now: number): void {
    this.texture.needsUpdate = true;
    const info = this.info;
    if (info.draws > 0) info.minGapMs = Math.min(info.minGapMs, now - info.lastDrawAt);
    info.draws += 1;
    info.lastDrawAt = now;
    info.text = [s.text[0], s.text[1], s.text[2]];
  }

  dispose(): void {
    this.disposed = true;
    for (const off of this.unsubs) off();
    this.unsubs = [];
    if (this.timer !== 0) window.clearTimeout(this.timer);
    this.timer = 0;
    window.clearTimeout(this.idleTimer);
    window.clearTimeout(this.echoTimer);
    disposeSheen(this.sheen);
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
