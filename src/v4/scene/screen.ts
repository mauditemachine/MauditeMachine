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

// Decoupe en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) : la classe dans scene/screen/core.ts, ses constantes
// dans consts.ts, ses methodes par domaine dans les autres fichiers (menus/ : un fichier par menu, menus/registry.ts le
// registre des menus a venir) ; ce baril garde la liste des exports d'avant (aucun import du site ne change).
export * from './screen/core';
export { PRESET_LAYOUT, presetKeySpot, INFO_KEY, blockSpot, infoKeySpot } from './screen/consts';

// Les methodes de Screen rangees par fichier (P0) : chacun les pose sur Screen.prototype quand ce baril se charge.
import './screen/draw';
import './screen/home';
import './screen/head';
import './screen/dials';
import './screen/grid';
import './screen/glyphs';
import './screen/foot';
import './screen/popups';
import './screen/menus/presets';
import './screen/menus/sounds';
import './screen/menus/mixer';
import './screen/menus/mutes';
