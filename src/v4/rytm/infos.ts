/**
 * Le contenu des INFOS du MM-RYTM (2026-10-08, Mika : "excellent pour le
 * bouton INFO ! je veux un petit bouton i dans l'ecran a activer et de ce
 * fait on peut voir les infos au survol.. et je veux la meme chose pour RYTM
 * aussi !"). Une carte par commande, en francais, dans la voix des INFOS du
 * MM-BASS (bass/infos.ts : tutoiement, typo quebecoise, espace insecable
 * avant le deux-points et entre un nombre et son unite, apostrophe
 * typographique ; jamais de tiret cadratin) : sa section (la page et la
 * lettre de son bloc : AMP C), son nom tel qu'il est a l'ecran, ce qu'elle
 * fait DANS cette machine (les lois de audio/voicefx.ts, kit.ts,
 * shotsdsp.ts, sampledsp.ts, tone.ts, time.ts, fx.ts, sends.ts, chorus.ts,
 * pattern.ts et de actions.ts, verifiees le 2026-10-08 sur l'etape R2), sa
 * course et son unite, et une astuce pour la dark disco, l'indie dance ou le
 * minimal. Les dessins, les ids et la table des blocs : rytm/diagrams.ts.
 *
 * infoOf(id, ctx) rend la carte d'une commande :
 * - id : un id de rytm/diagrams.ts (vdecay, r:tune, trig, pad:SD, lock...),
 *   ou un potard de page p:0 a p:7, resolu pour la page affichee et la voix
 *   choisie (K.TUNE sur BD, SNAPPY sur SD au bloc C de SRC) ;
 * - ctx.voice : la voix choisie ; un texte qui depend de la voix suit
 *   (SOUND sur BD parle des kicks, sur CY d'un seul son) ;
 * - ctx.plate : un potard de la plaque TWEAKS (OPEN) : son nom et sa section
 *   de plaque ; ctx.step : le pas montre (STEP 05, LOCK 05) ;
 * - ctx.lockable : ce que dit rytm/pages.ts du bloc (slot.lock, scope ALL) ;
 *   il passe avant la table d'ici (celle de l'etape R2), au cas ou une etape
 *   rende un reglage verrouillable ; sauf pour une voix qui n'a rien a y
 *   verrouiller (SAMPLE sur une voix sans echantillon : pas de phrase).
 * Les reglages a venir (avail soon) et les couches de l'etape R3 (avail r3)
 * ont leur carte, marquee : la carte peut ecrire BIENTOT, R3 n'a qu'a
 * relire leur texte une fois branches.
 */

import type { Inst } from '../theme';
import {
  RYTM_INFO_PAGE_LABEL,
  RYTM_LETTERS,
  resolveRytmId,
  rytmAvail,
  rytmSlotOf,
  voiceGroup,
  type RytmInfoAvail,
  type RytmInfoId,
  type RytmResolveCtx,
  type RytmVoiceGroup,
} from './diagrams';

export type { RytmInfoAvail, RytmInfoId } from './diagrams';
export { rytmInfoHit, resolveRytmId, soonInfoId } from './diagrams';

/**
 * Le verrou d'un reglage (P-lock, 2026-10-08) : yes, il se verrouille pas
 * par pas ; no, pas encore (NO LOCK a l'ecran) ; global, toute la machine,
 * jamais (GLOBAL) ; vel, la velocite du pas lui-meme.
 */
export type RytmLockable = 'yes' | 'no' | 'global' | 'vel';

export interface RytmInfo {
  /** l'id de la carte (un potard de page : le reglage qu'il tient) */
  id: RytmInfoId;
  /** la section (AMP C, TWEAKS / KICK, TRANSPORT...), en petites capitales sur la carte */
  section: string;
  /** le nom, tel qu'a l'ecran ou serigraphie */
  title: string;
  text: string;
  tip?: string;
  /** live : branche ; soon : un reglage a venir ; r3 : les couches SYNTH et SAMPLE de l'etape R3 */
  avail: RytmInfoAvail;
  /** pour un reglage des pages : son verrou */
  lock?: RytmLockable;
}

export interface RytmInfoCtx extends RytmResolveCtx {
  /** un potard de la plaque TWEAKS (OPEN), pas un potard de page */
  plate?: boolean;
  /** le pas montre (un pas, le LOCK) : 0 a 15 */
  step?: number;
  /** le verrou du bloc d'apres rytm/pages.ts (slot.lock : yes ; scope all : global ; sinon no) */
  lockable?: RytmLockable;
}

/** Les mots d'une voix ; lock null : rien a verrouiller pour cette voix (SAMPLE sur une voix sans echantillon), pas de phrase de verrou. */
type Words = Partial<Pick<Raw, 'title' | 'text' | 'tip'>> & { lock?: RytmLockable | null };

interface Raw {
  section: string;
  title: string;
  text: string;
  tip?: string;
  lock?: RytmLockable;
  /** sur la plaque TWEAKS : son nom serigraphie et sa section */
  plate?: { title: string; section: string };
  /** la voix choisie change les mots : par voix (BD...), par famille (bd, sd, hh, cp, tom, cy), ou sans voix (none) */
  voice?: Partial<Record<Inst | RytmVoiceGroup | 'none', Words>>;
}

/** Les espaces insecables du francais (Quebec) et l'apostrophe typographique (comme bass/infos.ts). */
const fr = (x: string): string =>
  x
    .replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, '$1’$2')
    .replace(/ :/g, ' :')
    .replace(/(\d) (ms|s|Hz|kHz|dB|dBFS|%|demi-tons?|pas|mesures?|BPM|px)(?![A-Za-zÀ-ÿ])/g, '$1 $2');

/** La phrase du verrou, ajoutee au texte d'un reglage des pages. */
const LOCK_LINE: Readonly<Record<RytmLockable, string>> = {
  yes: 'Se verrouille pas par pas (LOCK) : un pas peut garder sa propre valeur.',
  no: "Pas encore verrouillable : en LOCK, son bloc affiche NO LOCK et l'écran le dit si tu le tournes.",
  global: "Global : tout le MM-RYTM (ALL sur son bloc), jamais verrouillé sur un pas ; en LOCK, son bloc affiche GLOBAL et l'écran le dit si tu le tournes.",
  vel: "En LOCK, c'est la vélocité du pas lui-même, comme sur une Elektron.",
};

const NO_BD = "BD est choisi : ce réglage ne touche pas le kick (NO BD à l'écran) ; pour lui, la rangée du haut.";

const RAW: Record<RytmInfoId, Raw> = {
  /* ---------- les touches de page ---------- */
  trig: {
    section: 'PAGES',
    title: 'TRIG',
    text: "La page des pas : VEL, la vélocité du pas choisi (le dernier touché, ou celui en LOCK), et SWING, le retard des doubles croches paires de tout le MM-RYTM. PROB, MICRO, COND, RTRG et RTIM viendront ici. La LED montre la page affichée ; [ et ] passent d'une page à l'autre ; un nouvel appui sur la touche allumée montre HOME.",
    tip: 'En LOCK, VEL change la force d’un seul pas : un charley plus doux sur un contretemps, les autres ne bougent pas.',
  },
  src: {
    section: 'PAGES',
    title: 'SRC',
    text: "La source de la voix choisie : SOUND (909, 808, MM ou un sample de sa famille) et TUNE, pour toutes les voix ; puis ce que sa famille a de plus : le kick ses K.TUNE, ATTACK, DECAY et DRIVE, la caisse claire SNAPPY et GATE, le clap GATE. STRETCH, en bas à droite, étire les coups de tout le MM-RYTM. C'est la page de départ.",
    tip: 'Choisis BD, puis SRC : tout le kick se construit sur cette page.',
  },
  smpl: {
    section: 'PAGES',
    title: 'SMPL',
    text: "L'échantillon de la voix : SAMPLE (OFF, et c'est le son de synthèse de sa famille qui joue ; sinon l'un de ses samples) et START, l'endroit où le coup commence. Aujourd'hui, seuls BD et SD ont des samples. TUNE, FINE, BR, END, LOOP et LEVEL viendront avec la couche SAMPLE.",
    tip: 'Choisis un kick de Mika ici, puis règle-le sur SRC (K.TUNE, ATTACK, DECAY, DRIVE) : le grain du fichier, réglé comme une machine.',
  },
  fltr: {
    section: 'PAGES',
    title: 'FLTR',
    text: "Le filtre de la voix : TONE, un passe-bas vers la gauche, un passe-haut vers la droite, qui transpose aussi le coup. L'enveloppe du filtre (ATK, DEC), RESO, TYPE et ENV viendront.",
  },
  amp: {
    section: 'PAGES',
    title: 'AMP',
    text: "L'enveloppe et le niveau de la voix : DEC (la queue du coup), PAN (sa place entre gauche et droite) et VOL (son niveau), tous verrouillables pas par pas. ATK et HOLD viendront.",
    tip: 'La page des ghost notes : en LOCK, un VOL plus bas et un DEC plus court sur quelques pas de caisse claire.',
  },
  fx: {
    section: 'PAGES',
    title: 'FX',
    text: "Les effets, en deux rangées, colonne par colonne : en haut ceux de la voix choisie (son nom en étiquette), dessous ceux de tout le MM-RYTM, sauf le kick : il a sa propre voie (NO BD quand BD est choisi). Ses effets à lui sont donc ceux du haut.",
    tip: 'En dark disco, un DELAY sur la seule caisse claire (rangée du haut, SD) : l’écho reste derrière le kick.',
  },

  /* ---------- TRIG ---------- */
  'step:vel': {
    section: 'TRIG',
    title: 'VEL',
    lock: 'vel',
    text: "La vélocité du pas choisi, en neuf niveaux de 14 à 127 à l'écran : 127 (HIGH) joue le coup plein, 85 (MID) à 60 % du gain, 42 (LOW) à 32 %, et 0 (OFF) vide le pas (ses verrous restent). Le pas choisi est le dernier touché ; tenir un pas et glisser dessus fait la même chose.",
    tip: 'Des charleys à 85 et un 127 juste avant le temps : le roulement qui fait avancer l’indie dance.',
    voice: {
      bd: { tip: 'Sur BD, la vélocité dose aussi le SIDECHAIN du MM-ARP : un kick plus doux le creuse moins.' },
      none: { text: "La vélocité du pas choisi, en neuf niveaux de 14 à 127 à l'écran. Touche d'abord un pad : les pas sont ceux de la voix choisie." },
    },
  },
  swing: {
    section: 'TRIG',
    title: 'SWING',
    lock: 'global',
    text: "Retarde les doubles croches paires (2, 4... 16) de tout le MM-RYTM, jusqu'à un tiers de pas : de 50 % (droit) à 67 % (le shuffle de triolet), le rapport s'affiche sous la valeur. Une première visite part à 55 % ; deux tapes le remettent droit, à 50 %.",
    tip: '55 à 58 % pour l’indie dance et la house, 50 % pour une techno raide, 60 % et plus pour un minimal qui balance.',
  },

  /* ---------- SRC ---------- */
  vsound: {
    section: 'SRC',
    title: 'SOUND',
    lock: 'yes',
    text: "Le son de la voix choisie : 909, 808 ou MM (des sons de synthèse calculés par la machine), puis les samples de sa famille. CH et OH partagent le même choix, TOM et HT aussi ; CY n'a qu'un son. La liste s'ouvre à l'écran quand tu le tournes, et chaque son est recalé à son niveau : en changer ne fait pas sauter le volume. En LOCK, c'est un sample lock : ce pas joue un autre son, de sa famille ou d'une autre (CP 909 sur un pas de BD), par la voie de la voix.",
    voice: {
      bd: {
        text: "Le son du kick : 909, 808 ou MM (calculés par la machine), puis les samples de Mika, chacun à son nom ; K.TUNE, ATTACK, DECAY et DRIVE les règlent tous. Tous sortent à la même crête : le kick est la référence du mix. En LOCK, c'est un sample lock : ce pas joue un autre kick, ou le son d'une autre famille (CP 909) par la voie du kick.",
        tip: '909 pour une techno qui claque, 808 pour un minimal rond et long, un sample de Mika pour l’indie dance.',
      },
      sd: {
        text: "Le son de la caisse claire : 909, 808 ou MM, puis les samples de Mika. SNAPPY, sur cette page, règle son timbre ; GATE n'agit que sur la caisse claire MM. En LOCK, c'est un sample lock : ce pas joue un autre son (une autre caisse claire, un clap...).",
        tip: 'MM avec GATE sur ON pour la dark disco des années 80 ; un sample sec pour l’indie dance.',
      },
      hh: {
        text: "Le son des charleys : 909, 808 ou MM, le même pour CH et OH. 808 : six carrés métalliques ; 909 : plus de souffle que de métal. En LOCK, ce pas peut jouer le son d'une autre famille.",
        tip: '808 pour un minimal métallique, 909 pour une house qui respire.',
      },
      cp: {
        text: "Le son du clap : 909, 808 ou MM ; GATE (SRC D) lui ajoute sa petite pièce en MM et en 909. En LOCK, ce pas peut jouer le son d'une autre famille.",
        tip: 'Un clap 808 un pas après la caisse claire : le flam de la dark disco.',
      },
      tom: {
        text: "Le son des toms : 909, 808 ou MM, le même pour TOM (le grave) et HT (l'aigu). En LOCK, ce pas peut jouer le son d'une autre famille.",
        tip: 'Toms 808 et TUNE verrouillé pas par pas : une ligne de percussions pour le minimal.',
      },
      cy: {
        text: "CY n'a qu'un son à elle, calculé par la machine : le bloc affiche --. En LOCK, un pas de CY peut quand même jouer le son d'une autre famille (un sample lock).",
      },
      none: { text: "Le son de la voix choisie : 909, 808, MM ou un sample de sa famille. Touche d'abord un pad." },
    },
  },
  vtune: {
    section: 'SRC',
    title: 'TUNE',
    lock: 'yes',
    text: "La hauteur de la voix, au demi-ton, de -24 à +24 (deux octaves de chaque côté) ; la ligne du dessous nomme l'intervalle (5TH, OCTAVE). Le coup est recalculé à sa hauteur, comme un sampler : plus aigu, il est aussi plus court. TONE (FLTR E) transpose aussi, de ±7 demi-tons.",
    tip: 'Verrouille +5, +7 ou +12 sur deux ou trois pas de TOM : une petite mélodie de toms façon minimal, sans changer de son.',
    voice: {
      bd: { tip: 'Pour accorder le kick, K.TUNE (SRC C) ; TUNE sert aux sauts d’un pas à l’autre, en LOCK.' },
    },
  },
  'r:tune': {
    section: 'SRC / BD',
    title: 'K.TUNE',
    lock: 'no',
    plate: { title: 'TUNE', section: 'TWEAKS / KICK' },
    text: "La hauteur du kick lui-même. Sur un son de synthèse, une octave de course autour de sa note : 52 Hz au milieu en 909 et en MM (de 37 à 74 Hz), 49 Hz en 808 ; la ligne du dessous donne les Hz. Sur un sample, ±12 demi-tons, le milieu garde le fichier à sa hauteur. Le kick est recalculé en fond à chaque cran.",
    tip: 'Accorde le kick sur la tonique : vers 46 Hz pour un fa dièse, la tonalité du site, sous la basse du MM-BASS.',
  },
  'r:attack': {
    section: 'SRC / BD',
    title: 'ATTACK',
    lock: 'no',
    plate: { title: 'ATTACK', section: 'TWEAKS / KICK' },
    text: "La frappe du kick, le clic du début. En 909, le front du déclencheur vers 3,2 kHz et un souffle de 3 ms ; en 808, un petit tic vers 1,1 kHz ; en MM, un clic feutré vers 1,6 kHz. À 0, plus de clic. Sur un sample, le milieu (64) garde sa frappe ; plus haut elle claque (jusqu'à +6 dB sur ses 4 premières ms), plus bas elle s'adoucit.",
    tip: 'Plus d’ATTACK pour un kick qui perce sur un petit système ; moins pour un kick d’indie dance rond qui laisse la place à la basse.',
  },
  'r:decay': {
    section: 'SRC / BD',
    title: 'DECAY',
    lock: 'no',
    plate: { title: 'DECAY', section: 'TWEAKS / KICK' },
    text: "La longueur du kick, la queue de son boum ; la ligne du dessous donne sa constante de temps : de 90 à 630 ms en 909 (216 ms au départ), de 160 ms à 1,28 s en 808, de 60 à 240 ms en MM. Sur un sample, à partir de 57 (un peu sous le milieu) le fichier entier ; dessous, une fin en fondu de plus en plus tôt, jusqu'à 12 % de sa durée. AMP DEC (AMP C) coupe en plus la queue, après coup.",
    tip: 'Court (909 vers 150 ms) pour une techno serrée ; long en 808 pour un minimal où le kick tient aussi le grave.',
  },
  'r:drive': {
    section: 'SRC / BD',
    title: 'DRIVE',
    lock: 'no',
    plate: { title: 'DRIVE', section: 'TWEAKS / KICK' },
    text: "La saturation du kick, du rond vers le chaud et le compressé : tanh de 1,2 à 5,2 en 909, de 0,6 à 3,6 en 808, de 0,6 à 4,2 en MM ; sur un sample, propre jusqu'au quart (32), puis de plus en plus saturé. Le kick est ensuite recalé sur sa crête : DRIVE change son corps et sa couleur, pas son niveau de crête.",
    tip: '30 à 50 pour l’indie dance et la dark disco : le kick s’épaissit sans écraser la basse.',
  },
  'r:snappy': {
    section: 'SRC / SD',
    title: 'SNAPPY',
    lock: 'no',
    plate: { title: 'SNAPPY', section: 'TWEAKS / SNARE' },
    text: "Le claquant de la caisse claire : la part de son timbre (le bruit des cordes sous la caisse) face à sa peau. En 909, la part du bruit va de 0,3 à 2,1 ; en 808, de 0,2 à 1,6 ; en MM, de rien à deux fois le réglage d'usine (64). Sur un sample, 64 garde le fichier ; plus haut, plus de claquant au-dessus de 2 kHz ; plus bas, plus sourd.",
    tip: 'Plus de SNAPPY pour une caisse claire qui perce en indie dance ; moins pour une dark disco sourde et ronde.',
  },
  'r:gate': {
    section: 'SRC / SD + CP',
    title: 'GATE',
    lock: 'no',
    plate: { title: 'GATE', section: 'TWEAKS / SNARE + CLAP' },
    text: "La réverbe à porte, OFF ou ON, pour la caisse claire et le clap à la fois (SD + CP). ON : la caisse claire MM reçoit une pièce claire ouverte 130 ms puis fermée en 40 ms, le clap MM et le clap 909 une petite pièce. Rien sur les caisses claires 909 et 808, le clap 808, ni sur un sample.",
    tip: 'ON sur une caisse claire MM : la dark disco des années 80 ; OFF pour un minimal sec.',
  },
  stretch: {
    section: 'SRC',
    title: 'STRETCH',
    lock: 'global',
    text: "Raccourcit (à gauche) ou allonge (à droite) tous les coups du MM-RYTM, à la même hauteur, comme le Time d'Impulse : de x0.25 à x4, x1.00 au centre (-64 à +63 à l'écran, il colle au centre). Le coup est étiré en grains : l'attaque reste, les grains s'entendent aux extrêmes.",
    tip: 'Un peu à gauche pour une batterie sèche et serrée en minimal ; tout à droite pour des queues granuleuses dans un break.',
  },

  /* ---------- SMPL ---------- */
  'smpl:sample': {
    section: 'SMPL',
    title: 'SAMPLE',
    lock: 'yes',
    text: "L'échantillon de la voix : OFF, et c'est le son de synthèse de sa famille qui joue (la ligne du dessous le nomme : SYNTH 909) ; un cran plus loin, l'un de ses samples (la ligne dit son rang : 2 OF 6). Le même choix que SOUND (SRC A), sans ses trois sons de synthèse. Aujourd'hui, seuls BD et SD ont des samples ; les autres voix affichent --. En LOCK, un pas peut jouer un autre sample de la famille, ou OFF.",
    tip: 'Deux kicks de Mika qui alternent : le premier sur 1 et 9, le second verrouillé sur 5 et 13, la boucle respire.',
    voice: {
      sd: { tip: 'Deux caisses claires de Mika qui alternent : verrouille la seconde sur le pas 13, la mesure respire.' },
      hh: {
        text: "L'échantillon de la voix. Les charleys n'ont pas encore de sample : le bloc affiche -- et NO SAMPLES, et l'écran le dit si tu le tournes, en LOCK aussi. Aujourd'hui, seuls BD et SD en ont.",
        tip: 'SOUND (SRC A) choisit le son des charleys : 909, 808 ou MM.',
        lock: null,
      },
      cp: {
        text: "L'échantillon de la voix. Le clap n'a pas encore de sample : le bloc affiche -- et NO SAMPLES, et l'écran le dit si tu le tournes, en LOCK aussi. Aujourd'hui, seuls BD et SD en ont.",
        tip: 'SOUND (SRC A) choisit le son du clap : 909, 808 ou MM.',
        lock: null,
      },
      tom: {
        text: "L'échantillon de la voix. Les toms n'ont pas encore de sample : le bloc affiche -- et NO SAMPLES, et l'écran le dit si tu le tournes, en LOCK aussi. Aujourd'hui, seuls BD et SD en ont.",
        tip: 'SOUND (SRC A) choisit le son des toms : 909, 808 ou MM.',
        lock: null,
      },
      cy: {
        text: "L'échantillon de la voix. CY n'a qu'un son, calculé par la machine, et pas de sample : le bloc affiche --, et l'écran le dit si tu le tournes. Aujourd'hui, seuls BD et SD en ont.",
        lock: null,
      },
    },
  },
  vstart: {
    section: 'SMPL',
    title: 'START',
    lock: 'yes',
    text: "Où le coup commence dans son échantillon, de 0 (FROM TOP, le début) à 90 % (90% IN) ; il finit au même endroit, il est donc d'autant plus court. Marche aussi sur les sons de synthèse : la machine les joue comme des échantillons.",
    tip: 'Un START vers 20 % verrouillé sur un pas de caisse claire : il perd son attaque, une note fantôme sans changer de son.',
    voice: {
      bd: { tip: 'Sur BD, un START verrouillé un peu plus loin saute la frappe : un kick plus mou, un pas sur deux, en minimal.' },
    },
  },

  /* ---------- FLTR ---------- */
  tone: {
    section: 'FLTR',
    title: 'TONE',
    lock: 'no',
    text: "Le filtre de la voix, à zéro au centre (FLAT, de -64 à +63) : vers la gauche un passe-bas qui descend de 20 kHz à 900 Hz (LP), vers la droite un passe-haut qui monte de 20 à 180 Hz (HP). La hauteur bascule avec, jusqu'à -7 demi-tons à gauche et +7 à droite. Au centre (à moins de 4 %), il colle à zéro : rien n'est calculé.",
    tip: 'Un peu à droite sur les charleys et le clap : moins de grave qui traîne sous le kick. À gauche, un tom sombre et plus grave pour la dark disco.',
  },

  /* ---------- AMP ---------- */
  vdecay: {
    section: 'AMP',
    title: 'DEC',
    lock: 'yes',
    text: "La queue du coup. Tout en haut (FULL), le son entier ; en dessous, le coup garde ses 4 premières ms puis s'éteint de plus en plus tôt. La ligne du dessous donne sa durée jusqu'à -60 dB : 83 ms à 0, environ 650 ms au milieu, plusieurs secondes près du haut (le son lui-même peut finir avant).",
    tip: 'En LOCK, un DEC court sur le dernier OH de la mesure : un charley ouvert qui se ferme net avant le temps.',
    voice: {
      bd: { tip: 'Sur BD, un DEC court resserre un kick 808 trop long sans toucher à son DECAY (SRC E).' },
      OH: { tip: 'DEC vers 40 à 60 sur OH : un charley ouvert court et sec, la house en doubles croches.' },
    },
  },
  vpan: {
    section: 'AMP',
    title: 'PAN',
    lock: 'yes',
    text: "La place de la voix, de la gauche (-64) à la droite (+63), CENTER au milieu (il y colle à moins de 2 %). Hors du centre, le coup passe en mono à puissance constante : près du centre il sonne comme sans PAN, tout au bord il gagne +3 dB de ce côté. La ligne du dessous dit le côté (30% LEFT).",
    tip: 'Garde BD et SD au centre ; verrouille un charley ou un tom à gauche puis à droite, un pas sur deux : un groove qui bouge en indie dance.',
  },
  vol: {
    section: 'AMP',
    title: 'VOL',
    lock: 'yes',
    text: "Le niveau de la voix : 0.0 dB à 102 (80 %, le réglage d'usine), +3,9 dB tout en haut, rien à 0 ; la ligne du dessous le donne en dB. Les voix sont déjà calées sous le kick : la crête de la caisse claire reste au moins 1,5 dB sous la sienne, celle du clap 3,5 dB, celle des charleys 5,5 à 6 dB ; VOL part de là. Verrouillé, il change le gain de ce coup seulement, jusqu'à +12 dB au-dessus du VOL de la voix ; une voix à 0 reste muette, même verrouillée plus haut.",
    tip: 'Règle d’abord le kick, la référence (il sort vers -9 dBFS), puis monte le reste juste sous lui.',
    voice: {
      bd: { tip: 'Sur BD, VOL dose aussi le SIDECHAIN du MM-ARP. Le kick est la référence : règle le reste sous lui.' },
    },
  },

  /* ---------- FX : la voix (en haut) ---------- */
  vdist: {
    section: 'FX',
    title: 'DIST',
    lock: 'no',
    text: "La saturation de la voix choisie, en parallèle : une copie saturée (tanh, de 1 à 13 fois le gain) se mélange au son sec, qui baisse d'autant ; à fond, 85 % de saturé pour 15 % de sec. Après le filtre de la voix (TONE), avant son CHORUS ; à 0, rien n'est calculé.",
    tip: 'Un peu de DIST sur la caisse claire et le clap (20 à 30 %) : du mordant indie dance sans toucher au kick.',
    voice: {
      bd: { tip: 'Sur BD, c’est la seule DIST qui touche le kick (celle du bas ne le voit pas). Avec DRIVE (SRC F), dose-la peu.' },
    },
  },
  vchorus: {
    section: 'FX',
    title: 'CHORUS',
    lock: 'no',
    text: "Élargit la voix choisie : deux copies retardées de 14 et 21 ms qui ondulent lentement (0,53 et 0,71 Hz, ±7 ms), l'une à gauche, l'autre à droite. À fond, le son sec tombe à la moitié et le chorus joue plein. À 0, rien n'est calculé.",
    tip: 'Sur les charleys ou un clap en dark disco ; jamais sur le kick, il paraîtrait doublé.',
  },
  vdelay: {
    section: 'FX',
    title: 'DELAY',
    lock: 'no',
    text: "Envoie la voix choisie dans le DELAY du MM-RYTM : des répétitions à la croche pointée (3 pas, calées sur le tempo), chacune à 58 % de la précédente, qui s'assombrissent (entre 180 Hz et 4,5 kHz). L'envoi part après MASTER : baisser MASTER baisse aussi l'écho.",
    tip: 'Un DELAY sur la caisse claire en dark disco, ou sur un tom en minimal : la croche pointée remplit les trous sans rien programmer.',
  },
  vreverb: {
    section: 'FX',
    title: 'REVERB',
    lock: 'no',
    text: "Envoie la voix choisie dans la REVERB du MM-RYTM : une salle de 2,4 s (-60 dB au bout), aux aigus qui s'éteignent avant les graves. Comme le DELAY, l'envoi part après MASTER.",
    tip: 'Peu de REVERB, et seulement sur la caisse claire, le clap ou la cymbale : le kick reste sec et devant.',
  },

  /* ---------- FX : tout le MM-RYTM (en bas), sauf le kick ---------- */
  dist: {
    section: 'FX',
    title: 'DIST',
    lock: 'global',
    text: "La saturation parallèle de tout le MM-RYTM sauf le kick : la même loi que la DIST d'une voix (une copie saturée jusqu'à 13 fois le gain, 85 % de saturé pour 15 % de sec à fond), sur le bus des autres voix, avant leur CHORUS commun.",
    tip: '15 à 25 % pour souder charleys, clap et toms en indie dance ; le kick reste propre.',
    voice: { bd: { tip: NO_BD } },
  },
  chorus: {
    section: 'FX',
    title: 'CHORUS',
    lock: 'global',
    text: "Le CHORUS de tout le MM-RYTM sauf le kick : le même effet que celui d'une voix (deux retards de 14 et 21 ms qui ondulent), sur le bus des autres voix. Le kick en est sorti exprès : un chorus sur un kick le fait sonner doublé.",
    tip: 'Un soupçon (10 à 20 %) élargit charleys et clap en dark disco.',
    voice: { bd: { tip: NO_BD } },
  },
  delay: {
    section: 'FX',
    title: 'DELAY',
    lock: 'global',
    text: "L'envoi de toutes les voix sauf le kick vers le DELAY (la croche pointée, 58 % de retour) ; il part après MASTER.",
    tip: 'Dosé bas sur tout le kit, il fait rouler un minimal ; pour une seule voix, la rangée du haut.',
    voice: { bd: { tip: NO_BD } },
  },
  reverb: {
    section: 'FX',
    title: 'REVERB',
    lock: 'global',
    text: "L'envoi de toutes les voix sauf le kick vers la REVERB (la salle de 2,4 s) ; il part après MASTER.",
    tip: 'Moins de 15 % sur tout le kit : de l’air sans noyer le groove.',
    voice: { bd: { tip: NO_BD } },
  },

  /* ---------- la plaque TWEAKS (OPEN) : les choix de son ---------- */
  'r:bd': {
    section: 'TWEAKS / KICK',
    title: 'KICK',
    text: "Le son du kick, sous le capot : 909, 808, MM, puis les samples de Mika, chacun à son cran et à son nom. Le même réglage que SOUND (SRC A) quand BD est choisi. Tous sortent à la même crête : changer de kick ne change pas le niveau.",
    tip: '909 pour une techno qui claque, 808 pour un minimal rond et long, un sample de Mika pour l’indie dance.',
  },
  'r:sd': {
    section: 'TWEAKS / SNARE',
    title: 'SNARE',
    text: "Le son de la caisse claire : 909, 808, MM, puis les samples de Mika. Le même réglage que SOUND (SRC A) quand SD est choisi ; SNAPPY, à côté, règle son timbre.",
    tip: 'MM avec GATE sur ON pour la dark disco des années 80.',
  },
  'r:cp': {
    section: 'TWEAKS / CLAP',
    title: 'CLAP',
    text: "Le son du clap : 909, 808 ou MM. Le même réglage que SOUND (SRC A) quand CP est choisi ; GATE lui donne sa petite pièce en MM et en 909.",
  },
  'r:hh': {
    section: 'TWEAKS / HATS',
    title: 'HATS',
    text: "Le son des deux charleys, CH et OH : 909, 808 ou MM. Le même réglage que SOUND (SRC A) quand CH ou OH est choisi.",
    tip: '808 pour un minimal métallique, 909 pour une house qui respire.',
  },
  'r:tom': {
    section: 'TWEAKS / TOMS',
    title: 'TOMS',
    text: "Le son des deux toms, TOM (le grave) et HT (l'aigu) : 909, 808 ou MM. Le même réglage que SOUND (SRC A) quand TOM ou HT est choisi.",
  },

  /* ---------- les reglages a venir (l'etude, leur bloc reste vide) ---------- */
  'soon:prob': {
    section: 'TRIG',
    title: 'PROB',
    text: "Bientôt : la probabilité qu'un pas joue, de 0 à 100 % ; un charley à 50 % ne tombe qu'une fois sur deux, au hasard.",
    tip: 'Des charleys à 70 ou 80 % : un minimal qui ne se répète jamais tout à fait.',
  },
  'soon:micro': {
    section: 'TRIG',
    title: 'MICRO',
    text: 'Bientôt : décale un pas un peu avant ou après la grille, plus finement que SWING, pas par pas.',
    tip: 'Une caisse claire un rien en retard : la dark disco qui traîne.',
  },
  'soon:cond': {
    section: 'TRIG',
    title: 'COND',
    text: "Bientôt : une condition de pas, comme sur une Elektron : jouer une mesure sur deux (1:2), seulement la quatrième (4:4)...",
    tip: 'Un crash de CY en 1:4 : il ne tombe qu’au début de chaque phrase.',
  },
  'soon:rtrg': {
    section: 'TRIG',
    title: 'RTRG',
    text: 'Bientôt : le retrig, le pas répété plusieurs fois dans sa durée (des roulements de caisse claire, des charleys en rafale).',
  },
  'soon:rtim': {
    section: 'TRIG',
    title: 'RTIM',
    text: "Bientôt : la vitesse du retrig (1/16, 1/32...).",
  },
  'soon:fatk': {
    section: 'FLTR',
    title: 'ATK',
    text: "Bientôt : l'attaque de l'enveloppe du filtre de la voix.",
  },
  'soon:fdec': {
    section: 'FLTR',
    title: 'DEC',
    text: "Bientôt : la décroissance de l'enveloppe du filtre de la voix.",
  },
  'soon:freq': {
    section: 'FLTR',
    title: 'FREQ',
    text: 'Bientôt : la fréquence du filtre de la voix, qui prendra la place de TONE.',
  },
  'soon:reso': {
    section: 'FLTR',
    title: 'RESO',
    text: 'Bientôt : la résonance du filtre de la voix, un pic autour de sa fréquence.',
  },
  'soon:ftype': {
    section: 'FLTR',
    title: 'TYPE',
    text: 'Bientôt : le type du filtre (passe-bas, passe-haut, passe-bande).',
  },
  'soon:fenv': {
    section: 'FLTR',
    title: 'ENV',
    text: "Bientôt : de combien l'enveloppe ouvre ou ferme le filtre à chaque coup.",
  },
  'soon:attack': {
    section: 'AMP',
    title: 'ATK',
    text: "Bientôt : l'attaque de l'enveloppe d'ampli, une montée douce au lieu de la frappe.",
  },
  'soon:hold': {
    section: 'AMP',
    title: 'HOLD',
    text: "Bientôt : combien de temps le coup reste plein avant DEC (4 ms fixes aujourd'hui).",
  },
  'soon:br': {
    section: 'SMPL',
    title: 'BR',
    text: 'Bientôt : la réduction de bits, le grain des vieux samplers.',
  },
  'soon:loop': {
    section: 'SMPL',
    title: 'LOOP',
    text: "Bientôt : l'échantillon joué en boucle tant que le coup dure.",
  },

  /* ---------- l'etape R3 : les couches SYNTH et SAMPLE, comme l'Analog Rytm ---------- */
  'r3:machine': {
    section: 'SRC',
    title: 'MACHINE',
    text: "Bientôt : le type de la couche SYNTH, 909, 808 ou MM. Comme sur l'Analog Rytm, le son de synthèse et le sample jouent ensemble, chacun à son niveau, puis passent par la même voix (AMP, effets).",
  },
  'r3:synlevel': {
    section: 'SRC',
    title: 'SYNTH LEVEL',
    text: "Bientôt : le niveau de la couche SYNTH (le kick ou la caisse claire calculés par la machine) ; à 0, seul le sample joue.",
  },
  'r3:sweep': {
    section: 'SRC',
    title: 'SWEEP',
    text: 'Bientôt : la descente de hauteur du kick de synthèse, sa profondeur et son temps : court et profond, il claque ; plus long, il fait boum.',
  },
  'r3:sdtune': {
    section: 'SRC',
    title: 'TUNE',
    text: 'Bientôt : la hauteur de la peau de la caisse claire de synthèse.',
  },
  'r3:sddecay': {
    section: 'SRC',
    title: 'DECAY',
    text: 'Bientôt : la longueur de la caisse claire de synthèse.',
  },
  'r3:sdtone': {
    section: 'SRC',
    title: 'TONE',
    text: 'Bientôt : la couleur de la caisse claire de synthèse, de sourde à brillante.',
  },
  'r3:stune': {
    section: 'SMPL',
    title: 'TUNE',
    text: 'Bientôt : la hauteur de la couche SAMPLE, au demi-ton.',
  },
  'r3:sfine': {
    section: 'SMPL',
    title: 'FINE',
    text: "Bientôt : l'accord fin de la couche SAMPLE, entre deux demi-tons.",
  },
  'r3:send': {
    section: 'SMPL',
    title: 'END',
    text: "Bientôt : l'endroit où le sample s'arrête, sa longueur.",
  },
  'r3:smplevel': {
    section: 'SMPL',
    title: 'LEVEL',
    text: 'Bientôt : le niveau de la couche SAMPLE ; SAMPLE sur OFF ou LEVEL à 0 : seul le son de synthèse joue.',
  },
  'r3:reverse': {
    section: 'SMPL',
    title: 'REVERSE',
    text: "Bientôt : le sample joué à l'envers.",
  },

  /* ---------- les pads des voix ---------- */
  'pad:BD': {
    section: 'VOICES',
    title: 'BD',
    text: "Le kick, la référence du mix : il sort le plus fort, les autres voix sont calées sous sa crête. Il a sa propre voie (les effets du bas de FX ne le touchent pas) et il est monophonique : un nouveau coup coupe la queue du précédent en 3 ms. Touche le pad : il sonne (à l'arrêt) et devient la voix choisie. Touche A.",
    tip: 'Choisis la voix avant de toucher les pas : ils montrent et changent sa rangée.',
  },
  'pad:SD': {
    section: 'VOICES',
    title: 'SD',
    text: "La caisse claire : sa crête reste au moins 1,5 dB sous celle du kick. Touche le pad : elle sonne (à l'arrêt) et devient la voix choisie ; les pas, les encodeurs et l'écran la règlent. Touche S.",
  },
  'pad:CH': {
    section: 'VOICES',
    title: 'CH',
    text: "Le charley fermé : il coupe le charley ouvert qui sonne encore, en 8 ms, comme une 808. Touche le pad : il sonne (à l'arrêt) et devient la voix choisie. Touche D.",
  },
  'pad:OH': {
    section: 'VOICES',
    title: 'OH',
    text: "Le charley ouvert ; le prochain charley, fermé ou ouvert, le coupe en 8 ms. Touche le pad : il sonne (à l'arrêt) et devient la voix choisie. Touche F.",
    tip: 'OH sur les contretemps et CH partout ailleurs : le charley ouvert se ferme tout seul, la house classique.',
  },
  'pad:CP': {
    section: 'VOICES',
    title: 'CP',
    text: "Le clap : sa crête reste au moins 3,5 dB sous celle du kick. Touche le pad : il sonne (à l'arrêt) et devient la voix choisie. Touche Z.",
  },
  'pad:TOM': {
    section: 'VOICES',
    title: 'TOM',
    text: "Le tom grave ; TOM et HT partagent leur son (TOMS). Touche le pad : il sonne (à l'arrêt) et devient la voix choisie. Touche X.",
  },
  'pad:HT': {
    section: 'VOICES',
    title: 'HT',
    text: "Le tom aigu ; TOM et HT partagent leur son (TOMS). Touche le pad : il sonne (à l'arrêt) et devient la voix choisie. Touche C.",
  },
  'pad:CY': {
    section: 'VOICES',
    title: 'CY',
    text: "La cymbale, en stéréo large (sa gauche et sa droite ont leurs propres phases), la voix la plus basse du kit ; un seul son. Touche le pad : elle sonne (à l'arrêt) et devient la voix choisie. Touche V.",
  },

  /* ---------- les pas et le LOCK ---------- */
  step: {
    section: 'STEPS',
    title: 'STEPS',
    text: "Les 16 pas de la voix choisie. Touche un pas : vide, 127 (HIGH), 85 (MID), 42 (LOW), vide. Tiens-le et glisse : sa vélocité. Tiens-le 350 ms sans bouger : LOCK. Au téléphone, tiens un pas d'un doigt et tourne un encodeur d'un autre : le verrou se pose tout de suite. Un pas qui porte des verrous garde une lueur orange pâle sur sa touche, et un point dessous à l'écran. Dans EDIT, les 16 pas sont les 16 patterns.",
    tip: 'Le kick sur 1, 5, 9 et 13 (les pas encadrés), le clap ou la caisse claire sur 5 et 13 : la base du four on the floor.',
    voice: {
      none: { text: "Les 16 pas de la voix choisie : touche d'abord un pad (l'écran dit TAP A PAD FIRST). Ensuite, une touche sur un pas : vide, 127, 85, 42, vide ; tenu 350 ms : LOCK." },
    },
  },
  lock: {
    section: 'STEPS',
    title: 'LOCK',
    text: "Le parameter lock, comme sur une Elektron : un pas garde sa propre valeur d'un réglage. Tiens un pas 350 ms (ou L sur le pas choisi) : il passe en LOCK, il clignote, l'écran affiche LOCK 05 en négatif. Choisis la page, tourne un encodeur : ce réglage ne change que sur ce pas, son bloc passe en négatif. Deux tapes sur l'encodeur enlèvent ce verrou, CLEAR tous ceux du pas ; le même pas, Échap ou EDIT pour sortir, un autre pas pour y déplacer le LOCK. Lâché sans rien tourner, le LOCK reste ; lâché après avoir tourné, il s'en va. Verrouiller un pas vide y pose un coup. En lecture, les blocs verrouillés passent en négatif le temps de leur pas. Dans le Dock du téléphone, un appui long sur un pas le met en LOCK, et la page KNOBS règle ses verrous.",
    tip: 'Un sample lock : en LOCK sur le pas 16 de BD, tourne SOUND (SRC A) jusqu’à CP 909 ; le kick laisse la place à un clap en fin de mesure.',
  },

  /* ---------- le transport ---------- */
  run: {
    section: 'TRANSPORT',
    title: 'RUN/STOP',
    text: "Lance ou arrête le séquenceur du MM-RYTM ; une piste SoundCloud qui joue passe en pause. Le MM-BASS et le MM-ARP se calent sur sa grille quand ils jouent. En lecture, toucher un pad choisit sa voix sans la jouer. Touche Espace.",
  },
  clear: {
    section: 'TRANSPORT',
    title: 'CLEAR',
    text: "Vide les 16 pas de toutes les voix, et leurs verrous ; la lecture continue. En LOCK, n'efface que les verrous du pas, ses coups restent.",
  },
  random: {
    section: 'TRANSPORT',
    title: 'RANDOM',
    text: "Tire un motif 4x4 pour toutes les voix dans un style (HOUSE, TECH HOUSE, TECHNO, MINIMAL, INDIE DANCE, PROG ou ELECTRO), jamais deux fois le même style de suite, avec un TONE et un VOL tirés pour chaque voix. Le tempo, les effets, les autres réglages des voix et les verrous restent.",
    tip: 'Appuie jusqu’à ce qu’un groove t’accroche, puis garde-le dans un pattern avec EDIT.',
  },
  mute: {
    section: 'TRANSPORT',
    title: 'MUTE',
    text: "Un appui : la prochaine voix touchée se coupe (celle touchée juste avant, dans les 1,5 s, se coupe tout de suite). Deux appuis rapides : MULTI MUTE, chaque voix touchée se coupe ou revient. Un appui de plus : toutes les voix reviennent. Une voix coupée a son pad rouge, et ses verrous ne jouent pas.",
    tip: 'En live : MULTI MUTE, coupe le kick et les charleys huit mesures, puis un appui les rend tous d’un coup.',
  },
  solo: {
    section: 'TRANSPORT',
    title: 'SOLO',
    text: "Comme MUTE, mais la voix touchée joue seule (son pad passe en bleu) ; deux appuis rapides : plusieurs voix en solo. Un appui de plus : toutes reviennent.",
  },

  /* ---------- EDIT, OPEN, CLOSE ---------- */
  edit: {
    section: 'KEYS',
    title: 'EDIT',
    text: "Les 16 pas deviennent les 16 patterns (A01 à A16) : touche un pas pour jouer son pattern (en lecture, à la fin de la mesure), plusieurs dans les 2 s pour les enchaîner, tiens un vide pour y copier le pattern courant, verrous compris. L'éditeur du motif s'ouvre : les huit voix sur 16 pas, la vélocité en tenant une case. Une touche de page, EDIT, E ou Échap le referment.",
    tip: 'Quatre patterns enchaînés (A01 > A02 > A01 > A03) : une phrase de quatre mesures qui évolue toute seule.',
  },
  open: {
    section: 'KEYS',
    title: 'OPEN',
    text: "Soulève le capot : la plaque TWEAKS règle le kit (le son du KICK et ses TUNE, ATTACK, DECAY, DRIVE ; la caisse claire et son SNAPPY ; le clap ; GATE ; les charleys ; les toms). La musique continue. Touche O.",
  },
  close: {
    section: 'TWEAKS',
    title: 'CLOSE',
    text: 'Referme le capot du MM-RYTM. Touche O, ou Échap.',
  },

  /* ---------- MASTER et TEMPO ---------- */
  level: {
    section: 'MASTER',
    title: 'MASTER',
    text: "Le volume de tout le MM-RYTM, voix et effets compris (les envois REVERB et DELAY suivent) : un gain au carré, -3,9 dB au réglage d'usine (102 à l'écran), 0 dB tout en haut. Il ne touche ni le MM-BASS, ni le MM-ARP, ni le volume du site.",
    tip: 'Règle MASTER une fois, puis équilibre les machines au MIXER du MM-DECKS (voie 1).',
  },
  tempo: {
    section: 'TEMPO',
    title: 'TEMPO',
    text: "Le tempo de tout le studio, de 100 à 150 BPM : le MM-BASS et le MM-ARP le suivent. Glisse vers le haut pour accélérer (100 px = 50 BPM), la molette va de 1 BPM, deux tapes le remettent à 130. Le DELAY reste à la croche pointée de ce tempo.",
    tip: '118 à 124 BPM pour l’indie dance et la dark disco, 124 à 128 pour le minimal et la house, 130 et plus pour la techno.',
  },

  /* ---------- l'ecran ---------- */
  screen: {
    section: 'SCREEN',
    title: 'SCREEN',
    text: "La vue PAGE, toujours là. En haut, la lecture, la page en pastille, la voix et son son, le pattern et le tempo ; puis huit blocs à la place des huit encodeurs (A B C D en haut, E F G H dessous), chacun avec sa valeur de 0 à 127 (de -64 à +63 pour un réglage centré, les demi-tons pour TUNE, le nom du cran pour un choix), son unité et son petit dessin. Dessous, les 16 pas de la voix et la tête de lecture, un point sous chaque pas verrouillé. Touche l'en-tête pour les presets ; la touche de page allumée, ou H, montre HOME.",
  },
  presets: {
    section: 'SCREEN',
    title: 'PRESETS',
    text: "Les presets du MM-RYTM : touche la moitié gauche ou droite du haut de l'écran (ou les flèches) pour le précédent ou le suivant ; en bas, SAVE, NAME, DEL et EXIT.",
  },
  seek: {
    section: 'SCREEN',
    title: 'TRACK',
    text: "La piste SoundCloud en cours, dans le pied de l'écran : touche la barre à l'endroit où tu veux reprendre la piste.",
  },
  ikey: {
    section: 'SCREEN',
    title: 'INFOS',
    text: "Allume l'aide : survole n'importe quelle commande du MM-RYTM (au téléphone, touche-la : sa carte s'affiche, la commande n'agit pas) pour lire ce qu'elle fait ; un encodeur montre le réglage qu'il tient sur la page allumée, pour la voix choisie. Le i se remplit tant que c'est allumé ; touche-le encore, ou Échap, pour l'éteindre.",
  },
  home: {
    section: 'SCREEN',
    title: 'HOME',
    text: "L'écran d'avant, l'anneau des pas et ses cartes : la touche de page déjà allumée (ou H) y mène, une touche de page ramène la vue PAGE. Les encodeurs gardent leur page ; sa LED reste à peine allumée.",
  },
  enc: {
    section: 'ENCODERS',
    title: 'ENCODER',
    text: "Les huit encodeurs A à H règlent la page allumée, pour la voix choisie ; leur valeur est à l'écran, de 0 à 127, dans le bloc à leur place. Ils sont sans fin : rien ne saute quand tu changes de page. Deux tapes : la valeur de départ (en LOCK, le verrou s'en va). Cette case est vide sur cette page. Au téléphone, la page KNOBS du Dock (onglet PAGES) a les mêmes huit encodeurs et les six touches de page.",
  },
};

/** Les mots de la voix choisie : la voix d'abord, puis sa famille, puis sans voix. */
function wordsFor(r: Raw, voice: Inst | null | undefined): Words {
  if (!r.voice) return {};
  if (!voice) return r.voice.none ?? {};
  return { ...(r.voice[voiceGroup(voice)] ?? {}), ...(r.voice[voice] ?? {}) };
}

/** La section d'un reglage : la plaque, sinon la page et la lettre de son bloc pour cette voix (AMP C), sinon celle de la table. */
function sectionOf(id: RytmInfoId, r: Raw, c: RytmInfoCtx): string {
  if (c.plate && r.plate) return r.plate.section;
  if (r.section === 'VOICES' || r.section === 'TRANSPORT' || r.section === 'SCREEN' || r.section === 'KEYS' || r.section === 'PAGES') return r.section;
  const at = rytmSlotOf(id, c.voice ?? null, c.page);
  if (at) return `${RYTM_INFO_PAGE_LABEL[at.page]} ${RYTM_LETTERS[at.k]}`;
  return r.section;
}

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/**
 * La carte d'une commande du MM-RYTM, null pour un id inconnu. Un potard
 * de page (p:0 a p:7) montre le reglage qu'il tient (ctx.page, ctx.voice,
 * ctx.target) ; une case vide, la carte des encodeurs (enc).
 */
export function infoOf(id: string, ctx: RytmInfoCtx = {}): RytmInfo | null {
  const rid = resolveRytmId(id, ctx);
  if (!rid) return null;
  const r = RAW[rid];
  const w = wordsFor(r, ctx.voice);
  // Une voix sans rien a verrouiller (lock null) passe avant tout : son bloc n'a rien a choisir
  const lock = w.lock === null ? undefined : (ctx.lockable ?? w.lock ?? r.lock);
  let title = ctx.plate && r.plate ? r.plate.title : (w.title ?? r.title);
  if (ctx.step !== undefined && ctx.step >= 0 && ctx.step < 16) {
    if (rid === 'step') title = `STEP ${two(ctx.step + 1)}`;
    else if (rid === 'lock') title = `LOCK ${two(ctx.step + 1)}`;
  }
  // La phrase du verrou : pour un reglage des pages (la plaque TWEAKS n'a pas de pas)
  const base = w.text ?? r.text;
  const text = lock && !ctx.plate ? `${base} ${LOCK_LINE[lock]}` : base;
  const tip = w.tip ?? r.tip;
  return {
    id: rid,
    section: sectionOf(rid, r, ctx),
    title,
    text: fr(text),
    ...(tip ? { tip: fr(tip) } : {}),
    avail: rytmAvail(rid),
    ...(lock ? { lock } : {}),
  };
}

/** Toutes les cartes (les tests, une page d'aide) : id, sans voix ni page. */
export function allRytmInfos(ctx: RytmInfoCtx = {}): RytmInfo[] {
  return (Object.keys(RAW) as RytmInfoId[]).map((id) => infoOf(id, ctx)).filter((x): x is RytmInfo => x !== null);
}
