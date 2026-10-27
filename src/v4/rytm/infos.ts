/**
 * Le contenu des INFOS du MM-RYTM (2026-10-08, Mika : "excellent pour le
 * bouton INFO ! je veux un petit bouton i dans l'ecran a activer et de ce
 * fait on peut voir les infos au survol.. et je veux la meme chose pour RYTM
 * aussi !"). Une carte par commande, en francais, dans la voix des INFOS du
 * MM-BASS (bass/infos.ts : tutoiement, typo quebecoise, espace insecable
 * avant le deux-points et entre un nombre et son unite, apostrophe
 * typographique ; jamais de tiret cadratin) : sa section (l'ecran et la
 * lettre de son bloc : ENV C), son nom tel qu'il est a l'ecran, ce qu'elle
 * fait DANS cette machine (les lois de audio/voicefx.ts, kit.ts,
 * shotsdsp.ts, sampledsp.ts, tone.ts, time.ts, fx.ts, sends.ts, chorus.ts,
 * pattern.ts et de actions.ts), sa course et son unite, et une astuce pour la
 * dark disco, l'indie dance ou le minimal. Les dessins, les ids et la table
 * des blocs : rytm/diagrams.ts et rytm/infoIds.ts.
 *
 * infoOf(id, ctx) rend la carte d'une commande :
 * - id : un id de rytm/infoIds.ts (vdecay, r:tune, voice, pad:SD, lock...),
 *   ou un bloc de l'ecran p:0 a p:7, resolu pour l'ecran affiche et la voix
 *   choisie ;
 * - ctx.voice : la voix choisie ; un texte qui depend de la voix suit
 *   (SOUND sur BD parle des kicks, sur CY d'un seul son) ;
 * - ctx.plate : un potard de la plaque TWEAKS (OPEN) : son nom et sa section
 *   de plaque ; ctx.step : le pas montre (STEP 05, P-LOCK 05) ;
 * - ctx.lockable : ce que dit rytm/pages.ts du bloc (slot.lock, scope ALL) ;
 *   il passe avant la table d'ici ; sauf pour une voix qui n'a rien a y
 *   verrouiller (MACHINE sur CY : pas de phrase).
 *
 * L'etape 2 (2026-10-09, Mika : "je veux merge SRC SMPL et TRIG ! ... AMP
 * doit s'appeler ENV et doit etre plus complet ; on doit ensuite avoir les FX
 * du Voice selectionne mais aussi les FX Globaux" ; "les encodeurs ne servent
 * qu'a faire les modifs des FX globaux de la machine" ; "j'aimerais autant en
 * mobile qu'en desktop pouvoir modifier les choses directement sur l'ecran") :
 * les cartes des pages VOICE (et son onglet SYNTH), FLTR (le vrai filtre),
 * ENV (ATK HOLD DEC), FX (VOICE FX et GLOBAL FX), de SOUND, MIX, FINE, du
 * filtre, de DLY TIME et DLY FB ; le P-LOCK se fait a l'ecran (les encodeurs
 * du desktop sont les FX globaux, jamais verrouilles) ; MUTE et SOLO a trois
 * etats (une voix, plusieurs, tenu : toutes reviennent). Les renvois d'une
 * carte a l'autre nomment l'ecran (VOICE SYNTH), pas une lettre : les blocs
 * changent de place d'une voix a l'autre.
 *
 * Les pages des FX globaux (2026-10-10, Mika : "quand je touche a un FX, par
 * exemple DELAY, dans l'ecran, ca doit afficher les configurations que je peux
 * avoir pour DELAY") : une carte par reglage (TONE de DIST, RATE et DEPTH du
 * CHORUS, TIME FEEDBACK TONE du DELAY, SIZE TONE PRE de la REVERB, RATE de BIT,
 * ATTACK et RELEASE du COMP), leurs lois dans audio/pattern.ts fxLaw ; GLOBAL FX
 * dit comment les ouvrir.
 */

import { BLOCKS_ARE_KNOBS, GLOBAL_ENCODERS, type Inst } from '../theme';
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
 * par pas ; no, pas (NO LOCK a l'ecran) ; global, toute la machine, jamais
 * (GLOBAL) ; vel, la velocite du pas lui-meme.
 */
export type RytmLockable = 'yes' | 'no' | 'global' | 'vel';

export interface RytmInfo {
  /** l'id de la carte (un bloc de l'ecran : le reglage qu'il tient) */
  id: RytmInfoId;
  /** la section (ENV C, TWEAKS / KICK, TRANSPORT...), en petites capitales sur la carte */
  section: string;
  /** le nom, tel qu'a l'ecran ou serigraphie */
  title: string;
  /** la recette en trois gestes, avant le texte (revue de R4 : le LOCK etait un paragraphe de 750 signes) */
  steps?: string[];
  text: string;
  /** la touche du clavier (Au clavier : S.) ; la carte ne l'ecrit qu'au desktop (revue de R4 : un telephone n'a pas de touche S) */
  key?: string;
  tip?: string;
  /** live : branche ; soon : un reglage a venir */
  avail: RytmInfoAvail;
  /** pour un reglage des ecrans : son verrou */
  lock?: RytmLockable;
}

export interface RytmInfoCtx extends RytmResolveCtx {
  /** un potard de la plaque TWEAKS (OPEN), pas un bloc de l'ecran */
  plate?: boolean;
  /** le pas montre (un pas, le P-LOCK) : 0 a 15 */
  step?: number;
  /** le verrou du bloc d'apres rytm/pages.ts (slot.lock : yes ; scope all : global ; sinon no) */
  lockable?: RytmLockable;
  /** un encodeur du desktop (0 a 7) : son FX global (2026-10-09) ; la section le dit */
  encoder?: number;
}

/** Les mots d'une voix ; lock null : rien a verrouiller pour cette voix (MACHINE sur CY), pas de phrase de verrou. */
type Words = Partial<Pick<Raw, 'title' | 'text' | 'tip'>> & { lock?: RytmLockable | null };

interface Raw {
  section: string;
  title: string;
  steps?: string[];
  text: string;
  /** la touche du clavier, sans phrase (S, Espace) */
  key?: string;
  tip?: string;
  lock?: RytmLockable;
  /** sur la plaque TWEAKS : son nom serigraphie et sa section */
  plate?: { title: string; section: string };
  /** la voix choisie change les mots : par voix (BD...), par famille (bd, sd, hh, cp, tom, cy), ou sans voix (none) */
  voice?: Partial<Record<Inst | RytmVoiceGroup | 'none', Words>>;
  /**
   * au telephone : les mots d'une carte qui parlait de la souris, des
   * encodeurs du desktop ou du clavier (theme.ts BLOCKS_ARE_KNOBS) ; la voix
   * choisie passe encore avant
   */
  phone?: { text?: string; steps?: string[] };
}

/** Le telephone : pas d'encodeurs sur la face, les blocs de l'ecran se glissent au doigt. */
const PHONE = BLOCKS_ARE_KNOBS;
/** La tape qui ouvre la page d'un FX (V.4.2, 2026-10-27) : au desktop l'ecran ne se touche plus, c'est celle de son potard. */
const TAP_KNOB = PHONE ? '' : ' ; au desktop, sur son potard';

/** Les mots d'une carte au telephone : un bloc se touche et se glisse, il ne se clique pas. */
const phoneWords = (x: string): string => (!PHONE ? x : x.replace(/deux clics/g, 'deux tapes').replace(/ ou sa molette/g, ''));

/**
 * Une voix a choisir d'abord (2026-10-27) : au telephone, un pad ; la face V.4.0 du desktop n'a plus de pads, une voix se
 * choisit avec TRK et un pas de 1 a 8 (la phase 2), au clavier (A S D F, Z X C V) ou au MIDI.
 */
const PICK = PHONE ? "Touche d'abord un pad." : "Choisis d'abord une voix : TRK et un pas de 1 à 8, ou le clavier (A S D F, Z X C V).";

/** Les espaces insecables du francais (Quebec) et l'apostrophe typographique (comme bass/infos.ts). */
const fr = (x: string): string =>
  x
    .replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, '$1’$2')
    .replace(/ :/g, ' :')
    .replace(/(\d) (ms|s|Hz|kHz|dB|dBFS|%|demi-tons?|pas|mesures?|BPM|px|octaves?|cents)(?![A-Za-zÀ-ÿ])/g, '$1 $2');

/** La phrase du verrou, ajoutee au texte d'un reglage des ecrans. */
const LOCK_LINE: Readonly<Record<RytmLockable, string>> = {
  yes: 'Se verrouille pas par pas (P-LOCK) : un pas peut garder sa propre valeur.',
  no: "Pas verrouillable : en P-LOCK, son bloc affiche NO LOCK à la place de son unité, et l'écran le dit si tu le glisses.",
  global: "Global : tout le MM-RYTM, jamais verrouillé sur un pas ; en P-LOCK, son bloc dit GLOBAL à la place de son unité, et l'écran le rappelle si tu le glisses (IS GLOBAL: NO P-LOCK).",
  vel: "En P-LOCK, c'est la vélocité du pas lui-même, comme sur une Elektron.",
};

const NO_BD = "BD est choisi : ce réglage ne touche pas le kick (NO BD à l'écran) ; pour lui, VOICE FX.";

/**
 * Un FX global a aussi son encodeur (2026-10-09 au desktop, au telephone aussi depuis le 2026-10-19) : la phrase ajoutee
 * a sa carte ; seulement les huit des encodeurs (2026-10-10 : les reglages de leurs pages, TIME et FEEDBACK compris,
 * n'en ont pas).
 */
const ENC_LINE = PHONE
  ? "C'est aussi l'un des huit encodeurs sous l'écran, toujours le même : glisse-le de haut en bas, l'écran passe sur sa page (GLOBAL FX pour STRETCH et SWING), son bloc cerné."
  : "C'est aussi l'un des huit encodeurs à droite de l'écran, toujours le même : tourne-le, son anneau suit la valeur, l'écran passe sur sa page (GLOBAL FX pour STRETCH et SWING), son bloc cerné.";
const ENC_IDS: ReadonlySet<string> = new Set(GLOBAL_ENCODERS);
/**
 * Au desktop depuis le 2026-10-27 (les potards suivent la page) : chaque bloc a son potard a droite de l'ecran, a sa
 * place ; la phrase ajoutee a la carte d'un reglage des ecrans (le telephone garde ENC_LINE sur ses FX globaux).
 */
const FACE_LINE = "Il a aussi son potard à droite de l'écran, à la même place que son bloc (A en haut à gauche, E en bas à gauche) : tourne-le, son anneau suit la valeur.";

const RAW: Record<RytmInfoId, Raw> = {
  /* ---------- les touches de page et les onglets (2026-10-09) ---------- */
  voice: {
    section: 'PAGES',
    title: 'VOICE',
    text: "Tout ce que joue la voix choisie, sur un seul écran (TRIG, SRC et SMPL réunis) : SOUND en grand (OFF, 909, 808, MM, puis les samples de sa famille, une seule liste), VOL en grand (son niveau ; en P-LOCK, celui du pas : vélocité et volume ne font qu'un), PITCH et FINE (la hauteur de toute la voix) ; sur une voix qui a des samples (BD, SD et OH au départ, et toute voix où tu as déposé les tiens), LEN et REV règlent le sample, et la touche VOICE allumée passe à l'onglet SYNTH (la machine sous le sample, MIX), puis revient ; sur les autres, elle montre HOME.",
    tip: 'Choisis le son (SOUND), puis son niveau (VOL) : la voix est posée. En P-LOCK, SOUND change le son d’un seul pas : un sample lock, comme sur l’Analog Rytm.',
  },
  synth: {
    section: 'PAGES',
    title: 'VOICE SYNTH',
    text: "L'onglet SYNTH de VOICE (les voix qui ont des samples : BD, SD, OH...) : la couche de synthèse, comme une machine de l'Analog Rytm. MACHINE (909, 808 ou MM, le son calculé), MIX (la synthèse et le sample comme un crossfader, de -64 la synthèse seule à +63 le sample seul, 0 les deux à fond), puis ses réglages : TUNE, ATTACK, SWEEP, DECAY et DRIVE pour le kick ; TUNE, SNAPPY, TONE, DECAY et GATE pour la caisse claire ; sur les autres voix, MACHINE et MIX seuls (le clap garde GATE). Chaque réglage dit la couche qu'il touche : MACHINE, la synthèse seule (au téléphone, l'onglet SYNTH le dit pour tous) ; BOTH, les deux. Les deux couches passent ensuite par la même voix (FLTR, ENV, FX). La touche VOICE encore, ou MAIN dans l'en-tête, ramène l'onglet principal.",
    tip: 'MIX vers 0 sur un kick de Mika : le grave d’un 909 accordé sous l’attaque du sample.',
  },
  fltr: {
    section: 'PAGES',
    title: 'FLTR',
    text: "Un vrai filtre par coup, comme sur une Elektron : FREQ (sa coupure, de 20 Hz à 20 kHz), RESO (sa bosse), TYPE (passe-bas, passe-haut ou passe-bande), et son enveloppe : ENV (de combien d'octaves elle ouvre ou ferme le filtre, ±5), ATK et DEC (sa montée, sa redescente). TONE, la bascule d'avant (un passe-bas à gauche, un passe-haut à droite), reste à côté. Le dessin FILTER montre la courbe ; en pointillé, la coupure au sommet de l'enveloppe. Tout se verrouille pas par pas. Au départ, le filtre est grand ouvert : rien n'est calculé.",
    tip: 'Un passe-bas vers 2 kHz, RESO à 60 et ENV à +2 : la caisse claire claque puis s’assombrit, la dark disco.',
  },
  env: {
    section: 'PAGES',
    title: 'ENV',
    text: "L'enveloppe du coup (l'ancien AMP, complet) : ATK (une montée douce au lieu de la frappe, de SNAP à 500 ms), HOLD (combien de temps il reste plein, de 4 ms à 1 s), DEC (sa queue ; tout en haut, le son entier), et le dessin AMP ENV qui les montre sur la grille des doubles croches. START (où commence le coup) et PAN (sa place) sont là aussi. Tout se verrouille pas par pas ; VOL est passé dans VOICE.",
    tip: 'La page des ghost notes : en P-LOCK, un ATK de 20 ms et un DEC court sur quelques pas de caisse claire.',
  },
  fx: {
    section: 'PAGES',
    title: 'FX',
    text: `Deux onglets. VOICE FX : les effets de la voix choisie (DIST, CHORUS, DELAY, REVERB, en quatre grands blocs, son nom en étiquette, au téléphone dans l'onglet de l'en-tête), tous verrouillables pas par pas. GLOBAL FX (la touche FX encore, ou GLOBAL dans l'en-tête) : les huit effets de tout le MM-RYTM, DIST (kick compris), CHORUS, DELAY et REVERB (sauf le kick, il a sa propre voie), STRETCH, SWING, BIT et COMP ; ceux-là ne se verrouillent jamais. Une tape sur DIST, CHORUS, DELAY, REVERB, BIT ou COMP ouvre sa page, avec ses réglages ; sur celles de DIST, CHORUS, DELAY et REVERB, deux onglets en haut : GLOBAL (la quantité de la machine) et la voix (BD : son envoi à elle, verrouillable), les réglages à côté restent ceux de la machine. Une tape sur un FX de VOICE FX ouvre sa page sur la voix ; la touche FX ramène GLOBAL FX, ou VOICE FX depuis la voix. ${PHONE ? 'Au desktop, ce sont aussi les huit encodeurs, dans le même ordre : en tourner un ouvre sa page.' : "Les huit potards à droite de l'écran tournent les blocs de la page montrée, à la même place (A en haut à gauche) ; un potard n'ouvre jamais de page."}`,
    tip: 'En dark disco, un DELAY sur la seule caisse claire (VOICE FX, SD) : l’écho reste derrière le kick.',
  },
  fxv: {
    section: 'PAGES',
    title: 'VOICE FX',
    text: "Les effets de la voix choisie, son nom en étiquette (au téléphone, l'onglet BD FX de l'en-tête le dit) : DIST (la saturation parallèle), CHORUS (l'élargissement), DELAY et REVERB (leurs envois). Tous se verrouillent pas par pas : un pas garde sa DIST, l'effet tient jusqu'au coup suivant de la voix, comme sur une Elektron. Pour le kick, ce sont ses seuls effets : les FX globaux ne le touchent pas. Une tape sur l'un d'eux ouvre sa page sur la voix : son envoi en grand, les réglages de la machine à côté (DELAY : TIME, FEEDBACK, TONE), GLOBAL en haut pour passer à la quantité de la machine ; la touche FX revient ici (sous GLOBAL, à GLOBAL FX).",
    tip: 'Une REVERB verrouillée sur le dernier clap de la mesure seulement : l’espace s’ouvre une fois, puis se referme.',
  },
  fxg: {
    section: 'PAGES',
    title: 'GLOBAL FX',
    text: "Les huit effets de tout le MM-RYTM, chacun à la place d'un des huit potards à droite de l'écran (deux rangées de quatre) : DIST (tout, kick compris), CHORUS, DELAY et REVERB (le bus des voix sauf le kick : NO BD), STRETCH (la longueur de tous les coups), SWING, BIT (la réduction de bits) et COMP (le compresseur). Clique DIST, CHORUS, DELAY, REVERB, BIT ou COMP : sa page s'ouvre, sa quantité en grand et ses réglages à côté (DELAY : TIME, FEEDBACK, TONE ; REVERB : SIZE, TONE, PRE ; COMP : THRESH, RATIO, ATTACK, RELEASE...). Sur les pages de DIST, CHORUS, DELAY et REVERB, l'onglet de la voix en haut (BD) passe à son envoi à elle, GLOBAL revient à la machine ; la touche FX ou Échap ramènent GLOBAL FX (sur BIT et COMP, GLOBAL dans l'en-tête aussi) ; deux clics remettent toujours un bloc à son départ. Jamais verrouillés sur un pas : en P-LOCK, leurs blocs disent GLOBAL à la place de leur unité.",
    phone: {
      text: "Les huit effets de tout le MM-RYTM, dans l'ordre des huit encodeurs sous l'écran (deux rangées de quatre) : DIST (tout, kick compris), CHORUS, DELAY et REVERB (le bus des voix sauf le kick : NO BD), STRETCH (la longueur de tous les coups), SWING, BIT (la réduction de bits) et COMP (le compresseur). Touche DIST, CHORUS, DELAY, REVERB, BIT ou COMP (ou glisse son encodeur) : sa page s'ouvre, sa quantité en grand et ses réglages à côté (DELAY : TIME, FEEDBACK, TONE ; REVERB : SIZE, TONE, PRE ; COMP : THRESH, RATIO, ATTACK, RELEASE...). Sur les pages de DIST, CHORUS, DELAY et REVERB, l'onglet de la voix en haut (BD) passe à son envoi à elle, GLOBAL revient à la machine ; la touche FX ramène GLOBAL FX (sur BIT et COMP, GLOBAL dans l'en-tête aussi) ; deux tapes remettent toujours un bloc à son départ. Jamais verrouillés sur un pas : en P-LOCK, leurs blocs disent GLOBAL à la place de leur unité.",
    },
    tip: 'Sur la page DELAY, TIME sur 1/8D et FEEDBACK vers 70 % : le rebond de l’indie dance ; un peu de DELAY global suffit.',
  },

  /* ---------- VOICE ---------- */
  'voice:sound': {
    section: 'VOICE',
    title: 'SOUND',
    lock: 'yes',
    // Le navigateur des sons (2026-10-18, Mika : "difficile la selection des samples dans RYTM, y aurait-il une autre facon ?")
    steps: [
      "Clique le potard A (SOUND, sur la page VOICE) : toute la liste de la voix s'ouvre sur l'écran (son rang, 7 / 24), le son du moment en surbrillance. L'écran ne se touche pas.",
      "Tourne le potard A (ou sa molette) : la voix joue le son d'avant ou d'après et la liste le suit ; à l'arrêt, tu l'entends une fois (en lecture, le motif la joue). ↑ ↓ au clavier font de même ; Échap, une touche de page ou un clic ailleurs la ferment.",
      "Glisse un WAV (ou AIFF, MP3, FLAC) sur la machine : il entre dans la liste de la voix choisie et joue tout de suite. Suppr (deux fois), liste ouverte, retire de ce navigateur le sample à toi qui joue.",
    ],
    phone: {
      steps: [
        "Touche le nom du son : toute la liste de la voix s'ouvre sur l'écran (son rang, 7 / 24), le son du moment en surbrillance ; glisse de haut en bas pour la faire défiler.",
        "Touche une ligne : la voix la joue et la liste reste ouverte ; à l'arrêt, tu l'entends une fois (en lecture, le motif la joue). Les flèches de l'en-tête passent au son d'avant ou d'après ; une touche de page ou une tape ailleurs la ferment.",
        "+ LOAD A FILE..., la dernière ligne : un fichier du téléphone (WAV, AIFF, MP3, FLAC) devient un sample de la voix et joue tout de suite. Tiens un de tes samples, puis touche-le encore : il part.",
      ],
    },
    text: "Ce que joue la voix, en une seule liste : OFF (elle se tait), 909, 808 ou MM (sa machine de synthèse), puis les samples de sa famille, chacun à son nom. Le nom en grand dit ce qui joue : BLUEPRINT + 909 quand le sample et la machine jouent ensemble (MIX, dans l'onglet SYNTH). Choisir une machine la remet à fond et coupe le sample ; choisir un sample le fait jouer seul, sauf si les deux couches jouaient déjà (le nouveau sample prend la place de l'ancien, la machine reste dessous). Chaque son est recalé à son niveau : en changer ne fait pas sauter le volume. En P-LOCK, la liste continue avec les samples des autres voix : un sample lock, joué seul sur ce pas.",
    tip: 'Deux kicks de Mika qui alternent : le premier sur 1 et 9, le second verrouillé (P-LOCK) sur 5 et 13, la boucle respire.',
    voice: {
      bd: { tip: '909 pour une techno qui claque, 808 pour un minimal rond et long, un sample de Mika pour l’indie dance.' },
      sd: { tip: 'Un sample sec pour l’indie dance ; MM avec GATE sur ON (VOICE SYNTH) pour la dark disco des années 80.' },
      ch: {
        text: "Ce que joue le charley fermé : OFF, 909, 808 ou MM, sa machine de synthèse (la sienne : OH a la sienne depuis le 2026-10-18). 808 : six carrés métalliques ; 909 : plus de souffle que de métal. Puis ses samples, ceux du dossier ch du site et ceux que tu déposes dans ce navigateur. En P-LOCK, la liste continue avec les samples des autres voix : un sample lock, joué seul sur ce pas.",
        tip: '808 pour un minimal métallique, 909 pour une house qui respire.',
      },
      oh: {
        text: "Ce que joue le charley ouvert : OFF, 909, 808 ou MM, sa machine de synthèse (la sienne, plus celle de CH). Puis ses samples, ceux du dossier oh du site et ceux que tu déposes dans ce navigateur. En P-LOCK, la liste continue avec les samples des autres voix : un sample lock, joué seul sur ce pas.",
        tip: 'Un 909 ouvert sur les contretemps au-dessus d’un CH 808 : la house qui respire.',
      },
      cp: {
        text: "Ce que joue le clap : OFF, 909, 808 ou MM, sa machine de synthèse ; GATE, à côté, lui ajoute sa petite pièce en MM et en 909. Puis ses samples, ceux du dossier cp du site et ceux que tu déposes dans ce navigateur. En P-LOCK, la liste continue avec les samples des autres voix : un sample lock, joué seul sur ce pas.",
        tip: 'Un clap 808 un pas après la caisse claire : le flam de la dark disco.',
      },
      tom: {
        text: "Ce que joue le tom grave : OFF, 909, 808 ou MM, sa machine de synthèse (la sienne : HT a la sienne depuis le 2026-10-18). Puis ses samples, ceux du dossier tom du site et ceux que tu déposes dans ce navigateur. En P-LOCK, la liste continue avec les samples des autres voix : un sample lock, joué seul sur ce pas.",
        tip: 'Tom 808 et PITCH verrouillé pas par pas : une ligne de percussions pour le minimal.',
      },
      ht: {
        text: "Ce que joue le tom aigu : OFF, 909, 808 ou MM, sa machine de synthèse (la sienne, plus celle de TOM). Puis ses samples, ceux du dossier ht du site (toms aigus, percussions, congas, rims) et ceux que tu déposes dans ce navigateur. En P-LOCK, la liste continue avec les samples des autres voix : un sample lock, joué seul sur ce pas.",
        tip: 'HT en 909 au-dessus d’un TOM 808 : deux timbres pour une relance de toms.',
      },
      cy: {
        text: "Ce que joue la cymbale : OFF, sa synthèse (909, 808 et MM donnent aujourd'hui le même son calculé), puis ses samples, ceux du dossier cy du site (cymbales, crashs, rides) et ceux que tu déposes dans ce navigateur. En P-LOCK, la liste continue avec les samples des autres voix : un sample lock, joué seul sur ce pas.",
        tip: 'Un kick de Mika verrouillé sur le dernier pas de CY : un coup sourd à la place du crash.',
      },
      none: { text: `Le son de la voix choisie : OFF, 909, 808, MM ou un sample de sa famille. ${PICK}` },
    },
  },
  vol: {
    section: 'VOICE',
    title: 'VOL',
    lock: 'yes',
    text: "Le niveau de la voix : 0.0 dB à 102 (80 %, le réglage d'usine), +3,9 dB tout en haut, rien à 0 ; la ligne du dessous le donne en dB. Les voix sont déjà calées sous le kick : la crête de la caisse claire reste au moins 1,5 dB sous la sienne, celle du clap 3,5 dB, celle des charleys 5,5 à 6 dB ; VOL part de là. En P-LOCK, c'est le volume du pas : il change le gain de ce coup seulement, jusqu'à +12 dB au-dessus du VOL de la voix ; une voix à 0 reste muette, même verrouillée plus haut. VOL fait aussi la vélocité (le bloc VEL l'a rejoint) : pour un coup plus doux sur un pas, verrouille son VOL, ou tiens le pas et glisse (sa vélocité, neuf niveaux).",
    tip: 'Règle d’abord le kick, la référence (il sort vers -9 dBFS), puis monte le reste juste sous lui.',
    voice: {
      bd: { tip: 'Sur BD, VOL dose aussi le SIDECHAIN du MM-ARP. Le kick est la référence : règle le reste sous lui.' },
    },
  },
  // Plus de bloc VEL (2026-10-10, fusionne dans VOL) : la carte reste pour les ids d'avant, sans phrase de verrou
  'step:vel': {
    section: 'VOICE',
    title: 'VEL',
    text: "La vélocité n'a plus de bloc à l'écran : VOL fait les deux (en P-LOCK, le volume du pas). Un pas vide touché prend la vélocité des nouveaux pas de la voix (HIGH au départ), une voix jouée à l'arrêt au clavier aussi ; celle d'un pas se change en le tenant puis en glissant, ou dans la rangée VEL de EDIT. Neuf niveaux de 14 à 127 : 127 (HIGH) joue le coup plein, 85 (MID) à 60 % du gain, 42 (LOW) à 32 %.",
    phone: {
      text: "La vélocité n'a plus de bloc à l'écran : VOL fait les deux (en P-LOCK, le volume du pas). Un pas vide touché prend la vélocité des nouveaux pas de la voix (HIGH au départ), un pad joué à l'arrêt aussi ; celle d'un pas se change en le tenant puis en glissant, ou dans la rangée VEL de EDIT. Neuf niveaux de 14 à 127 : 127 (HIGH) joue le coup plein, 85 (MID) à 60 % du gain, 42 (LOW) à 32 %.",
    },
    tip: 'Tiens un pas de charley et glisse vers 85, puis laisse un 127 juste avant le temps : le roulement qui fait avancer l’indie dance.',
    voice: {
      bd: { tip: 'Sur BD, la vélocité dose aussi le SIDECHAIN du MM-ARP : un kick plus doux le creuse moins.' },
      none: {
        text: PHONE
          ? "La vélocité n'a plus de bloc à l'écran : VOL fait les deux. Touche d'abord un pad, puis tiens un de ses pas et glisse : sa vélocité, en neuf niveaux de 14 à 127."
          : "La vélocité n'a plus de bloc à l'écran : VOL fait les deux. Choisis d'abord une voix au clavier (A S D F, Z X C V), puis tiens un de ses pas et glisse : sa vélocité, en neuf niveaux de 14 à 127.",
      },
    },
  },
  vtune: {
    section: 'VOICE',
    title: 'PITCH',
    lock: 'yes',
    text: "La hauteur de toute la voix, ses deux couches ensemble, au demi-ton, de -24 à +24 (deux octaves de chaque côté) ; la ligne du dessous nomme l'intervalle (5TH, OCTAVE). Le coup est recalculé à sa hauteur, comme un sampler : plus aigu, il est aussi plus court. FINE règle entre deux demi-tons ; TONE (FLTR) transpose aussi, de ±7 demi-tons.",
    tip: 'Verrouille +5, +7 ou +12 sur deux ou trois pas de TOM : une petite mélodie de toms façon minimal, sans changer de son.',
    voice: {
      bd: {
        text: "La hauteur de tout le kick, ses deux couches ensemble, au demi-ton, de -24 à +24. Le coup est recalculé à sa hauteur, comme un sampler : plus aigu, il est aussi plus court. FINE règle entre deux demi-tons ; TUNE (VOICE SYNTH) n'accorde que la synthèse.",
        tip: 'Verrouille -2 sur le dernier kick de la mesure : il retombe sans changer de son.',
      },
      sd: {
        text: "La hauteur de toute la caisse claire, ses deux couches ensemble, au demi-ton, de -24 à +24. Le coup est recalculé à sa hauteur : plus aigu, il est aussi plus court. FINE règle entre deux demi-tons ; TUNE (VOICE SYNTH) n'accorde que la peau de synthèse.",
        tip: 'Un +3 verrouillé sur une ghost note : la caisse claire répond plus haut, sans changer de son.',
      },
    },
  },
  vfine: {
    section: 'VOICE',
    title: 'FINE',
    lock: 'yes',
    text: "L'accord fin de toute la voix, de -64 à +64 cents (100 cents font un demi-ton), ajouté à PITCH ; les deux couches ensemble. Il colle au centre.",
    tip: 'Quelques cents pour caler le kick de Mika juste sur la note du MM-BASS : en minimal, le grave ne bat plus.',
  },
  'voice:mix': {
    section: 'VOICE SYNTH',
    title: 'MIX',
    lock: 'yes',
    text: "Les deux couches de la voix comme un crossfader, en un seul nombre : -64 à gauche, la synthèse seule (SYN), 0 au milieu, les deux à fond, +63 à droite, le sample seul (SMP) ; la ligne du dessous donne leurs deux niveaux, de 0 à 127, et OFF dit une voix qui se tait (SOUND sur OFF). La couche la plus forte garde le niveau du moment ; les deux à fond sont ramenées sous la crête de la voix, jamais remontées. Sans sample, glisser vers SMP en pose un (le premier de la famille).",
    tip: 'Un kick de Mika et un 909 vers 0, verrouillé (P-LOCK) sur les pas 4 et 12 seulement : le grave de la machine répond au sample.',
  },
  vsound: {
    section: 'VOICE',
    title: 'SOUND',
    text: "Le raccourci vers UNE couche, en un geste : 909, 808 ou MM (la couche SYNTH seule, remise à fond, le sample coupé), puis les samples de la famille (le sample seul, à fond, la synthèse à 0). C'est le sélecteur de son de la plaque TWEAKS (OPEN) et du MIDI ; sur l'écran, SOUND (VOICE) fait la même liste, et MIX (VOICE SYNTH) fait jouer les deux couches ensemble. Chaque voix a sa famille de sons depuis le 2026-10-18 (CH et OH, TOM et HT ne partagent plus rien ; CY a la sienne, sa synthèse puis ses samples). Chaque son est recalé à son niveau : en changer ne fait pas sauter le volume.",
    voice: {
      bd: { tip: '909 pour une techno qui claque, 808 pour un minimal rond et long, un sample de Mika pour l’indie dance.' },
      sd: { tip: 'MM avec GATE sur ON pour la dark disco des années 80 ; un sample sec pour l’indie dance.' },
      cy: { text: "Le son de la cymbale : sa synthèse (909, 808 et MM donnent aujourd'hui le même son calculé), puis ses samples (le dossier cy du site, ceux que tu déposes dans ce navigateur)." },
      none: { text: `Le son de la voix choisie : 909, 808, MM ou un sample de sa famille. ${PICK}` },
    },
  },
  'r:tune': {
    section: 'VOICE SYNTH',
    title: 'TUNE',
    lock: 'yes',
    plate: { title: 'SYN TUNE', section: 'TWEAKS / KICK' },
    text: "La hauteur du kick de synthèse, une octave de course autour de sa note : 52 Hz au milieu en 909 et en MM (de 37 à 74 Hz), 49 Hz en 808 ; la ligne du dessous donne les Hz. Il ne règle que la couche SYNTH : PITCH (VOICE) accorde tout le kick, le sample compris. Quand la synthèse se tait (MIX à +63), l'écran le dit. Le kick est recalculé en fond à chaque cran.",
    tip: 'Accorde le kick sur la tonique : vers 46 Hz pour un fa dièse, la tonalité du site, sous la basse du MM-BASS.',
  },
  'r:attack': {
    section: 'VOICE SYNTH',
    title: 'ATTACK',
    lock: 'yes',
    plate: { title: 'ATTACK', section: 'TWEAKS / KICK' },
    text: "La frappe du kick, sur ses deux couches (BOTH à l'écran). Sur la synthèse : le front du déclencheur vers 3,2 kHz et un souffle de 3 ms en 909, un petit tic vers 1,1 kHz en 808, un clic feutré vers 1,6 kHz en MM ; à 0, plus de clic. Sur le sample : le milieu (64) garde sa frappe ; plus haut elle claque (jusqu'à +6 dB sur ses 4 premières ms), plus bas elle s'adoucit.",
    tip: 'Plus d’ATTACK pour un kick qui perce sur un petit système ; moins pour un kick d’indie dance rond qui laisse la place à la basse.',
  },
  'r:decay': {
    section: 'VOICE SYNTH',
    title: 'DECAY',
    lock: 'yes',
    plate: { title: 'SYN DECAY', section: 'TWEAKS / KICK' },
    text: "La longueur du kick de synthèse, la queue de son boum ; la ligne du dessous donne sa constante de temps : de 90 à 630 ms en 909 (216 ms au départ), de 160 ms à 1,28 s en 808, de 60 à 240 ms en MM. Il ne règle que la couche SYNTH : le sample a son LEN (VOICE). DEC (ENV) coupe en plus la queue des deux, après coup.",
    tip: 'Court (909 vers 150 ms) pour une techno serrée ; long en 808 pour un minimal où le kick tient aussi le grave.',
  },
  'r:drive': {
    section: 'VOICE SYNTH',
    title: 'DRIVE',
    lock: 'yes',
    plate: { title: 'DRIVE', section: 'TWEAKS / KICK' },
    text: "La saturation du kick, sur ses deux couches (BOTH à l'écran), du rond vers le chaud et le compressé : tanh de 1,2 à 5,2 en 909, de 0,6 à 3,6 en 808, de 0,6 à 4,2 en MM ; sur le sample, propre jusqu'au quart (32), puis de plus en plus saturé. Le kick est ensuite recalé sur sa crête : DRIVE change son corps et sa couleur, pas son niveau de crête.",
    tip: '30 à 50 pour l’indie dance et la dark disco : le kick s’épaissit sans écraser la basse.',
  },
  'r:snappy': {
    section: 'VOICE SYNTH',
    title: 'SNAPPY',
    lock: 'yes',
    plate: { title: 'SNAPPY', section: 'TWEAKS / SNARE' },
    text: "Le claquant de la caisse claire, sur ses deux couches (BOTH à l'écran) : la part de son timbre (le bruit des cordes sous la caisse) face à sa peau. En 909, la part du bruit va de 0,3 à 2,1 ; en 808, de 0,2 à 1,6 ; en MM, de rien à deux fois le réglage d'usine (64). Sur le sample, 64 garde le fichier ; plus haut, plus de claquant au-dessus de 2 kHz ; plus bas, plus sourd.",
    tip: 'Plus de SNAPPY pour une caisse claire qui perce en indie dance ; moins pour une dark disco sourde et ronde.',
  },
  'r:gate': {
    section: 'VOICE SYNTH',
    title: 'GATE',
    lock: 'yes',
    plate: { title: 'GATE', section: 'TWEAKS / SNARE + CLAP' },
    text: "La réverbe à porte, OFF ou ON, pour la caisse claire et le clap à la fois (SD + CP). ON : la caisse claire MM et le sample de la caisse claire (BOTH, le kit de départ joue celui de Mika) reçoivent une pièce claire ouverte 130 ms puis fermée en 40 ms, le clap MM et le clap 909 une petite pièce. Rien sur les caisses claires de synthèse 909 et 808 ni sur le clap 808.",
    tip: 'ON sur une caisse claire MM : la dark disco des années 80 ; OFF pour un minimal sec.',
  },
  'smpl:sample': {
    section: 'VOICE',
    title: 'SAMPLE',
    lock: 'yes',
    text: "Le sample de la couche SAMPLE (l'ancien SMPL, encore au MIDI) : OFF (la couche se tait ; la synthèse joue seule, ou rien si elle est à 0 : l'écran le dit), ou l'un des samples de la famille (la ligne dit son rang : 2 OF 6). La couche SYNTH ne bouge pas. Sur l'écran, c'est SOUND (VOICE) qui le choisit. En P-LOCK, c'est le sample lock de l'Analog Rytm : un pas joue un autre sample de la voix, le sample d'une autre voix (il y joue seul, calé à son niveau), ou OFF.",
    tip: 'Deux kicks de Mika qui alternent : le premier sur 1 et 9, le second verrouillé sur 5 et 13, la boucle respire.',
    voice: {
      sd: { tip: 'Deux caisses claires de Mika qui alternent : verrouille la seconde sur le pas 13, la mesure respire.' },
      ch: { text: "La couche SAMPLE du charley fermé : OFF, puis ses samples (le dossier ch du site, ceux que tu déposes dans ce navigateur). Sans sample dans sa famille, le bloc affiche -- et NO SAMPLES. En P-LOCK, un pas peut prendre le sample d'une autre voix (un sample lock), joué seul sur ce pas." },
      oh: { text: "La couche SAMPLE du charley ouvert : OFF, puis ses samples (le dossier oh du site, ceux que tu déposes dans ce navigateur). Sans sample dans sa famille, le bloc affiche -- et NO SAMPLES. En P-LOCK, un pas peut prendre le sample d'une autre voix (un sample lock), joué seul sur ce pas." },
      cp: { text: "La couche SAMPLE du clap : OFF, puis ses samples (le dossier cp du site, ceux que tu déposes dans ce navigateur). Sans sample dans sa famille, le bloc affiche -- et NO SAMPLES. En P-LOCK, un pas peut prendre le sample d'une autre voix (un sample lock), joué seul sur ce pas." },
      tom: { text: "La couche SAMPLE du tom grave : OFF, puis ses samples (le dossier tom du site, ceux que tu déposes dans ce navigateur). Sans sample dans sa famille, le bloc affiche -- et NO SAMPLES. En P-LOCK, un pas peut prendre le sample d'une autre voix (un sample lock), joué seul sur ce pas." },
      ht: { text: "La couche SAMPLE du tom aigu : OFF, puis ses samples (le dossier ht du site : toms aigus, percussions, congas, rims ; ceux que tu déposes dans ce navigateur). Sans sample dans sa famille, le bloc affiche -- et NO SAMPLES. En P-LOCK, un pas peut prendre le sample d'une autre voix (un sample lock), joué seul sur ce pas." },
      cy: { text: "La couche SAMPLE de la cymbale : OFF, puis ses samples (le dossier cy du site : cymbales, crashs, rides ; ceux que tu déposes dans ce navigateur). Sans sample dans sa famille, le bloc affiche -- et NO SAMPLES. En P-LOCK, un pas peut prendre le sample d'une autre voix (un sample lock), joué seul sur ce pas : la cymbale s'y tait." },
    },
  },

  /* ---------- FLTR (2026-10-09 : le vrai filtre) ---------- */
  vfcut: {
    section: 'FLTR',
    title: 'FREQ',
    lock: 'yes',
    text: "La coupure du filtre de la voix, de 20 Hz à 20 kHz en loi exponentielle (632 Hz au milieu) ; la ligne du dessous la donne en Hz. En passe-bas (TYPE LP) tout en haut, le filtre est ouvert : rien n'est calculé, le son d'avant. Il agit sur chaque coup, ses deux couches ensemble, avant les FX de la voix.",
    tip: 'Un passe-bas qui descend pas par pas (P-LOCK) sur les charleys : un filtre qui se ferme sans automation.',
  },
  vfreso: {
    section: 'FLTR',
    title: 'RESO',
    lock: 'yes',
    text: "La résonance du filtre : une bosse autour de la coupure, d'un Q de 0,7 (aucune bosse, à 0) à 12 (un pic qui siffle), douce au début de la course. En passe-bande, elle resserre la bande et remonte la voix d'autant (jusqu'à +8,6 dB à fond) : posée sur le son, la bande garde son niveau.",
    tip: 'RESO vers 80 et ENV à +3 sur un tom : un tom qui chante, façon disco, accordé par FREQ.',
  },
  vftype: {
    section: 'FLTR',
    title: 'TYPE',
    lock: 'yes',
    text: "Le type du filtre, en trois crans : LP (passe-bas, il garde le grave), HP (passe-haut, il garde l'aigu) ou BP (passe-bande, il garde une bande autour de FREQ).",
    tip: 'HP vers 300 Hz sur le clap et les charleys : le grave reste au kick et à la basse.',
  },
  tone: {
    section: 'FLTR',
    title: 'TONE',
    lock: 'yes',
    text: "La bascule de couleur de la voix, à zéro au centre (FLAT, de -64 à +63) : vers la gauche un passe-bas qui descend de 20 kHz à 900 Hz (LP), vers la droite un passe-haut qui monte de 20 à 180 Hz (HP). La hauteur bascule avec, jusqu'à -7 demi-tons à gauche et +7 à droite. Au centre (à moins de 4 %), il colle à zéro : rien n'est calculé. Le filtre complet (FREQ, RESO, TYPE, ENV) est à côté.",
    tip: 'Un peu à droite sur les charleys et le clap : moins de grave qui traîne sous le kick. À gauche, un tom sombre et plus grave pour la dark disco.',
  },
  vfatk: {
    section: 'FLTR',
    title: 'ATK',
    lock: 'yes',
    text: "La montée de l'enveloppe du filtre, de SNAP (tout de suite) à 500 ms : le temps que la coupure met à atteindre son sommet (ENV). À ENV 0, l'enveloppe ne fait rien.",
    tip: 'Un ATK du filtre vers 80 ms sur un OH : le charley s’ouvre en respirant.',
  },
  vfdec: {
    section: 'FLTR',
    title: 'DEC',
    lock: 'yes',
    text: "La redescente de l'enveloppe du filtre vers FREQ, de 30 ms à près de 5 s ; la ligne du dessous donne sa durée utile (trois fois sa constante de temps). À ENV 0, l'enveloppe ne fait rien.",
    tip: 'Court pour un coup sec ; long pour une caisse claire qui s’assombrit sur toute la mesure.',
  },
  vfenv: {
    section: 'FLTR',
    title: 'ENV',
    lock: 'yes',
    text: "De combien l'enveloppe du filtre déplace la coupure à chaque coup, de -5 à +5 octaves au sommet (NO ENV au centre, il y colle) : à droite elle ouvre le filtre puis le referme, à gauche elle le ferme puis le rouvre. Sa forme : ATK et DEC, à côté.",
    tip: 'ENV à +2 et DEC court sur un passe-bas fermé : chaque coup claque puis s’éteint, sans toucher à FREQ.',
  },

  /* ---------- ENV (l'ancien AMP, 2026-10-09) ---------- */
  vatk: {
    section: 'ENV',
    title: 'ATK',
    lock: 'yes',
    text: "L'attaque du coup : une montée douce au lieu de la frappe, de SNAP (la frappe, à 0) à 500 ms en loi exponentielle (22 ms au milieu). Le coup monte de rien à plein, HOLD le tient, puis DEC fait sa queue.",
    tip: 'Un ATK de 10 à 20 ms sur les charleys : moins de clic, un groove plus doux pour l’indie dance.',
  },
  vhold: {
    section: 'ENV',
    title: 'HOLD',
    lock: 'yes',
    text: "Combien de temps le coup reste plein avant DEC : 4 ms au départ (la frappe), jusqu'à 1 s en loi exponentielle (49 ms au milieu). Utile surtout avec un DEC court : le coup tient, puis se coupe net.",
    tip: 'HOLD vers 100 ms et DEC court sur un OH : un charley ouvert carré, la house des années 90.',
  },
  vdecay: {
    section: 'ENV',
    title: 'DEC',
    lock: 'yes',
    text: "La queue du coup. Tout en haut (FULL), le son entier ; en dessous, le coup tient pendant HOLD puis s'éteint de plus en plus tôt. La ligne du dessous donne sa durée jusqu'à -60 dB : 83 ms à 0, environ 650 ms au milieu, plusieurs secondes près du haut (le son lui-même peut finir avant).",
    tip: 'En P-LOCK, un DEC court sur le dernier OH de la mesure : un charley ouvert qui se ferme net avant le temps.',
    voice: {
      bd: { tip: 'Sur BD, un DEC court resserre un kick 808 trop long sans toucher à son DECAY (VOICE SYNTH).' },
      OH: { tip: 'DEC vers 40 à 60 sur OH : un charley ouvert court et sec, la house en doubles croches.' },
    },
  },
  vstart: {
    section: 'ENV',
    title: 'START',
    lock: 'yes',
    text: "Où commence tout le coup de la voix, ses deux couches ensemble, de 0 (le début) à 90 % de sa longueur : ce qui est sauté ne joue pas, la frappe disparaît la première.",
    tip: 'Verrouillé sur quelques pas de charley : la frappe disparaît, il ne reste que le souffle.',
  },
  vpan: {
    section: 'ENV',
    title: 'PAN',
    lock: 'yes',
    text: "La place de la voix, de la gauche (-64) à la droite (+63), CENTER au milieu (il y colle à moins de 2 %). Hors du centre, le coup passe en mono à puissance constante : près du centre il sonne comme sans PAN, tout au bord il gagne +3 dB de ce côté. La ligne du dessous dit le côté (30% LEFT).",
    tip: 'Garde BD et SD au centre ; verrouille un charley ou un tom à gauche puis à droite, un pas sur deux : un groove qui bouge en indie dance.',
  },

  /* ---------- VOICE FX : les effets de la voix ---------- */
  vdist: {
    section: 'VOICE FX',
    title: 'DIST',
    lock: 'yes',
    text: "La saturation de la voix choisie, en parallèle : une copie saturée (tanh, de 1 à 13 fois le gain) se mélange au son sec, qui baisse d'autant ; à fond, 85 % de saturé pour 15 % de sec. En montant, le sec et le saturé baissent ensemble : un kick ou une caisse claire garde son niveau, un son plus doux (charleys, cymbale) gagne surtout de la densité. Après le filtre de la voix (TONE), avant son CHORUS ; à 0, rien n'est calculé. Verrouillée sur un pas, elle tient jusqu'au coup suivant de la voix. Sa page (une tape sur ce bloc) montre aussi TONE, le passe-bas après la saturation : il est commun à toutes les DIST du MM-RYTM, celle de la machine et celles des voix.",
    tip: 'Un peu de DIST sur la caisse claire et le clap (20 à 30 %) : du mordant indie dance sans toucher au kick.',
    voice: {
      bd: { tip: 'Sur BD, c’est la seule DIST qui touche le kick (la globale ne le voit pas). Avec DRIVE (VOICE SYNTH), dose-la peu.' },
    },
  },
  vchorus: {
    section: 'VOICE FX',
    title: 'CHORUS',
    lock: 'yes',
    text: "Élargit la voix choisie : deux copies retardées de 14 et 21 ms qui ondulent lentement (0,53 et 0,71 Hz, ±7 ms), l'une à gauche, l'autre à droite. À fond, le son sec tombe à la moitié et le chorus joue plein ; la voix garde à peu près son niveau (le sec et le chorus baissent ensemble). La copie de gauche part du côté gauche de la voix, celle de droite du côté droit : une voix placée à droite par PAN reste à droite. À 0, rien n'est calculé. Verrouillé sur un pas, il tient jusqu'au coup suivant de la voix. Sa page (une tape sur ce bloc) montre aussi RATE et DEPTH : ils règlent tous les CHORUS du MM-RYTM, celui de la machine et ceux des voix.",
    tip: 'Sur les charleys ou un clap en dark disco ; jamais sur le kick, il paraîtrait doublé.',
  },
  vdelay: {
    section: 'VOICE FX',
    title: 'DELAY',
    lock: 'yes',
    text: "Envoie la voix choisie dans le DELAY du MM-RYTM, celui de toutes les voix : des répétitions au temps de TIME (la croche pointée au départ, calée sur le tempo), au retour de FEEDBACK (58 % au départ), assombries par TONE (4,5 kHz au départ) ; ces trois réglages sont sur la page DELAY, à côté de cet envoi (une tape sur ce bloc l'ouvre sur la voix, GLOBAL en haut passe à la machine). L'envoi part après MASTER : baisser MASTER baisse aussi l'écho.",
    tip: 'Un DELAY sur la caisse claire en dark disco, ou sur un tom en minimal : l’écho remplit les trous sans rien programmer.',
  },
  vreverb: {
    section: 'VOICE FX',
    title: 'REVERB',
    lock: 'yes',
    text: "Envoie la voix choisie dans la REVERB du MM-RYTM, celle de toutes les voix : une salle de 2,4 s au départ (-60 dB au bout), aux aigus qui s'éteignent avant les graves ; sa longueur, ses aigus et son pré-delay (SIZE, TONE, PRE) sont sur la page REVERB, à côté de cet envoi (une tape sur ce bloc l'ouvre sur la voix). Comme le DELAY, l'envoi part après MASTER.",
    tip: 'Peu de REVERB, et seulement sur la caisse claire, le clap ou la cymbale : le kick reste sec et devant.',
  },

  /* ---------- GLOBAL FX : tout le MM-RYTM (les huit encodeurs sous l'ecran) ---------- */
  dist: {
    section: 'GLOBAL FX',
    title: 'DIST',
    lock: 'global',
    text: `La saturation parallèle de tout le MM-RYTM, kick compris : la même loi que la DIST d'une voix (une copie saturée jusqu'à 13 fois le gain, 85 % de saturé pour 15 % de sec à fond), sur le bus des voix avant leur CHORUS commun, et sur la voie du kick. En montant, le sec et le saturé baissent ensemble : le kick et la caisse claire gardent leur niveau, les sons plus doux gagnent de la densité. Sa page (une tape sur son bloc de GLOBAL FX${TAP_KNOB}) ajoute TONE, le passe-bas après la saturation (celui de toutes les DIST, celles des voix comprises).`,
    tip: "15 à 25 % pour souder le kick, les charleys, le clap et les toms en indie dance ; plus haut, le kick grogne.",
  },
  chorus: {
    section: 'GLOBAL FX',
    title: 'CHORUS',
    lock: 'global',
    text: `Le CHORUS de tout le MM-RYTM sauf le kick : le même effet que celui d'une voix (deux retards de 14 et 21 ms qui ondulent), sur le bus des autres voix. Le kick en est sorti exprès : un chorus sur un kick le fait sonner doublé. Sa page (une tape sur son bloc de GLOBAL FX${TAP_KNOB}) règle RATE (la vitesse des ondulations) et DEPTH (leur profondeur), pour tous les CHORUS, ceux des voix compris.`,
    tip: 'Un soupçon (10 à 20 %) élargit charleys et clap en dark disco.',
    voice: { bd: { tip: NO_BD } },
  },
  delay: {
    section: 'GLOBAL FX',
    title: 'DELAY',
    lock: 'global',
    text: `L'envoi de toutes les voix sauf le kick vers le DELAY ; il part après MASTER. Sa page (une tape sur son bloc de GLOBAL FX${TAP_KNOB}) règle l'écho lui-même, pour toutes les voix : TIME (sa division, calée sur le tempo), FEEDBACK (ses répétitions) et TONE (sa couleur).`,
    tip: 'Dosé bas sur tout le kit, il fait rouler un minimal ; pour une seule voix, VOICE FX.',
    voice: { bd: { tip: NO_BD } },
  },
  reverb: {
    section: 'GLOBAL FX',
    title: 'REVERB',
    lock: 'global',
    text: `L'envoi de toutes les voix sauf le kick vers la REVERB ; il part après MASTER. Sa page (une tape sur son bloc de GLOBAL FX${TAP_KNOB}) règle la salle elle-même, pour toutes les voix : SIZE (sa longueur, 2,4 s au départ), TONE (ses aigus) et PRE (son pré-delay).`,
    tip: 'Moins de 15 % sur tout le kit : de l’air sans noyer le groove.',
    voice: { bd: { tip: NO_BD } },
  },
  stretch: {
    section: 'GLOBAL FX',
    title: 'STRETCH',
    lock: 'global',
    text: "Raccourcit (à gauche) ou allonge (à droite) tous les coups du MM-RYTM, à la même hauteur, comme le Time d'Impulse : de x0.25 à x4, x1.00 au centre (-64 à +63 à l'écran, il colle au centre). Le coup est étiré en grains : l'attaque reste, les grains s'entendent aux extrêmes.",
    tip: 'Un peu à gauche pour une batterie sèche et serrée en minimal ; tout à droite pour des queues granuleuses dans un break.',
  },
  swing: {
    section: 'GLOBAL FX',
    title: 'SWING',
    lock: 'global',
    text: "Retarde les doubles croches paires (2, 4... 16) de tout le MM-RYTM, jusqu'à un tiers de pas : de 50 % (droit) à 67 % (le shuffle de triolet), le rapport s'affiche sous la valeur. Une première visite part à 55 % ; deux clics le remettent droit, à 50 %.",
    tip: '55 à 58 % pour l’indie dance et la house, 50 % pour une techno raide, 60 % et plus pour un minimal qui balance.',
  },
  // TIME et FEEDBACK de la page DELAY (2026-10-10 ; DLY TIME et DLY FB d'avant, au MIDI rytm:enc:dtime et dfb)
  dtime: {
    section: 'GLOBAL FX · DELAY',
    title: 'TIME',
    lock: 'global',
    text: "Le temps du DELAY du MM-RYTM, en six divisions calées sur le tempo : 1/16, 1/8, 1/8D (la croche pointée, au départ), 1/4, 1/4D et 1/2 ; la ligne du dessous le donne en ms. Il change le DELAY de toutes les voix, celui de la voix choisie (VOICE FX) compris. D'un temps à l'autre (ou quand le tempo change), les échos passent en fondu de 60 ms : ils ne glissent pas.",
    tip: '1/8D pour l’indie dance, 1/4 pour une techno hypnotique, 1/16 pour un flam serré sur la caisse claire.',
  },
  dfb: {
    section: 'GLOBAL FX · DELAY',
    title: 'FEEDBACK',
    lock: 'global',
    text: "Les répétitions du DELAY : la part de chaque écho renvoyée dans le suivant, de 0 (un seul écho) à 87 % (une longue traîne qui ne s'emballe jamais : chaque écho garde au plus 87 % du précédent, ses filtres compris) ; 58 % au départ. Quand l'envoi revient à 0, la traîne va jusqu'au bout avant que le DELAY s'arrête.",
    tip: 'Vers 30 % pour un écho discret ; au-delà de 75 %, un dub qui s’étire pendant une pause.',
  },
  bits: {
    section: 'GLOBAL FX',
    title: 'BIT',
    lock: 'global',
    text: `La réduction de bits de tout le MM-RYTM, kick, REVERB et DELAY compris : à 0 (OFF) le son passe tel quel ; en montant, la profondeur tombe de 16 à 4 bits, le grain des vieilles boîtes à rythmes puis la casse franche. Le nombre de bits s'affiche sous la valeur. Sa page (une tape sur son bloc de GLOBAL FX${TAP_KNOB}) ajoute RATE, l'échantillonnage divisé.`,
    tip: 'Un peu (12 à 10 bits) pour salir les charlestons ; à fond pour une pause lo-fi, puis CLEAR remet tout à 0.',
  },
  comp: {
    section: 'GLOBAL FX',
    title: 'COMP',
    lock: 'global',
    text: `Le compresseur de bus de tout le MM-RYTM, kick, REVERB et DELAY compris, façon SSL G et API 2500. COMP est son MIX : à 0 (OFF) le son passe tel quel, au bit près ; en montant, le son compressé se mêle au son sec (la compression parallèle, façon New York) ; à fond, il est seul. Sa page (une tape sur son bloc${TAP_KNOB}) règle le reste : THRESH et RATIO en haut, à côté de COMP, puis ATTACK, RELEASE, MAKEUP et le HPF de sa chaîne latérale ; l'aiguille GR sous COMP montre la réduction, en dB. Sans anticipation : le MM-RYTM reste calé sur le MM-BASS et le MM-ARP. À fond avec MAKEUP AUTO, le niveau moyen reste celui du son sec, mais les attaques qui passent avant ATTACK sortent environ 1 dB plus haut : le limiteur de sortie les tient.`,
    tip: "Pour coller un kit dark disco : RATIO 4:1, ATTACK 10 à 30 ms, RELEASE AUTO, THRESH descendu jusqu'à 3 à 6 dB sur l'aiguille, puis COMP vers 60 % : le corps se serre, la frappe reste devant.",
  },

  /* ---------- les pages des FX globaux (2026-10-10) : leurs reglages ---------- */
  xtone: {
    section: 'GLOBAL FX · DIST',
    title: 'TONE',
    lock: 'global',
    text: "Le passe-bas de toutes les DIST du MM-RYTM (la globale et celles des voix), posé après la saturation : de 1 kHz (une saturation sourde et ronde) à 16 kHz ; tout en haut (OPEN, le départ), il ne retire rien. La ligne du dessous donne sa coupure. Sans DIST, il ne fait rien.",
    tip: 'Vers 4 kHz : la saturation épaissit charleys et clap sans grésiller, la dark disco.',
  },
  crate: {
    section: 'GLOBAL FX · CHORUS',
    title: 'RATE',
    lock: 'global',
    text: "La vitesse des deux ondulations de tous les CHORUS du MM-RYTM (le global et ceux des voix), de x0.1 à x4 de celle de départ (X1.0 : 0,53 et 0,71 Hz) ; la ligne du dessous donne le facteur. Lent, le son flotte ; rapide, il tremble comme un vibrato.",
    tip: 'X0.3 à X0.5 pour un chorus lent et large en dark disco ; au-delà de X2, un vibrato marqué sur les charleys.',
  },
  cdepth: {
    section: 'GLOBAL FX · CHORUS',
    title: 'DEPTH',
    lock: 'global',
    text: "De combien ondulent les deux retards de tous les CHORUS du MM-RYTM (le global et ceux des voix), de 0 (aucune ondulation, un simple doublage) à 14 ms ; 7 ms au départ, en ms sous la valeur. Plus profond, le son s'élargit et se désaccorde.",
    tip: 'Peu de DEPTH (2 à 4 ms) et un RATE lent : un élargissement discret qui ne désaccorde pas le clap.',
  },
  dtone: {
    section: 'GLOBAL FX · DELAY',
    title: 'TONE',
    lock: 'global',
    text: "Le passe-bas des échos du DELAY, de 800 Hz (des échos sombres, au loin) à 12 kHz (brillants) ; 4,5 kHz au départ, la coupure sous la valeur. Plus bas, les répétitions reculent et laissent la place au kit. Commun à toutes les voix, celle de VOICE FX comprise.",
    tip: 'Vers 2 kHz pour un écho dub qui reste derrière ; tout en haut pour un rebond qui claque en indie dance.',
  },
  rsize: {
    section: 'GLOBAL FX · REVERB',
    title: 'SIZE',
    lock: 'global',
    text: "La longueur de la queue de la REVERB (jusqu'à -60 dB), de 0,5 s (une petite pièce) à 8 s (une cathédrale) ; 2,4 s au départ, en secondes sous la valeur. Commune à toutes les voix, celle de VOICE FX comprise.",
    tip: 'Moins d’une seconde pour une caisse claire serrée en minimal ; 4 à 6 s, dosée bas, pour une nappe derrière un break.',
  },
  rtone: {
    section: 'GLOBAL FX · REVERB',
    title: 'TONE',
    lock: 'global',
    text: "Les aigus de la queue de la REVERB : la fréquence au-dessus de laquelle elle s'éteint plus vite, de 1 kHz (une salle sombre et feutrée) à 12 kHz (brillante) ; 3 kHz au départ, en Hz sous la valeur.",
    tip: 'Sombre (1 à 2 kHz) : la reverbe enveloppe sans siffler sur les charleys ; brillante pour un clap qui s’ouvre.',
  },
  rpre: {
    section: 'GLOBAL FX · REVERB',
    title: 'PRE',
    lock: 'global',
    text: "Le pré-delay : le temps entre le coup et le début de sa REVERB, de 0 à 120 ms ; 20 ms au départ. Un peu de PRE garde la frappe sèche devant, la salle arrive juste après.",
    tip: '30 à 60 ms sur la caisse claire : elle garde son attaque, la reverbe suit derrière.',
  },
  brate: {
    section: 'GLOBAL FX · BIT',
    title: 'RATE',
    lock: 'global',
    text: "L'échantillonnage du BIT divisé, de /1 (OFF, rien ne change) à /16 : chaque échantillon est tenu plusieurs fois, les aigus se replient en sons métalliques, le grain des vieux samplers. Le diviseur s'affiche sous la valeur. Il n'agit que BIT engagé : BIT à 0, le son passe tel quel.",
    tip: '/2 à /4 avec BIT vers 12 bits : le grain des samplers des années 80 ; /16 pour une casse franche le temps d’une pause.',
  },
  // Le COMP refait le 2026-10-18 : ses reglages, dans l'ordre de sa page (KNEE n'a pas de case : MIDI et Roto)
  cthr: {
    section: 'GLOBAL FX · COMP',
    title: 'THRESH',
    lock: 'global',
    text: "Le seuil du COMP : le niveau au-dessus duquel il commence à serrer, de 0 dB (presque rien ne le dépasse) à -40 dB (tout est compressé) ; -18 dB au départ, en dB à l'écran. Plus il descend, plus la réduction est forte : l'aiguille GR, sous COMP, la montre. Le seuil, le rapport et le genou dessinent la courbe de la carte.",
    tip: "Descends-le en regardant l'aiguille : 2 à 4 dB sur les kicks pour un bus qui colle, 6 dB et plus pour un kit qui pompe.",
  },
  cratio: {
    section: 'GLOBAL FX · COMP',
    title: 'RATIO',
    lock: 'global',
    text: "De combien le COMP serre ce qui dépasse le seuil, en huit crans : 1:1 (rien), 1,5, 2, 3, 4 (le départ), 6, 10 et 20:1 (presque un limiteur). À 4:1, 4 dB au-dessus du seuil n'en font plus qu'un. Le mot sous la valeur dit son caractère : SOFT, GENTLE, GLUE, PUNCH, SMASH, LIMIT.",
    tip: "2:1 ou 4:1 pour coller le kit comme un SSL ; 10:1 avec COMP vers 40 % : une compression parallèle qui écrase le corps et garde la frappe sèche.",
  },
  catk: {
    section: 'GLOBAL FX · COMP',
    title: 'ATTACK',
    lock: 'global',
    text: "Le temps que met le COMP à serrer quand un coup dépasse le seuil, de 0,1 ms (il écrase la frappe) à 50 ms (la frappe passe entière, le corps est compressé) ; 10 ms au départ, en ms sous la valeur. La carte dessine la réduction sur un coup : elle se creuse après la frappe.",
    tip: "10 à 30 ms : le kick et la caisse claire gardent leur claque, le reste se serre ; 1 ms et moins pour aplatir des charleys trop pointus.",
  },
  crel: {
    section: 'GLOBAL FX · COMP',
    title: 'RELEASE',
    lock: 'global',
    text: "Le temps que met le COMP à relâcher, de 20 ms à 0,78 s, en ms sous la valeur ; tout en haut, AUTO (le départ) : le retour suit la musique, rapide après un coup bref (60 ms), lent quand la compression dure (jusqu'à 1,2 s), comme l'AUTO d'un SSL. Court, le niveau remonte entre les coups et les queues gonflent (le pompage) ; long, le kit reste serré et égal.",
    tip: "AUTO pour coller sans y penser ; calé sur une double croche (vers 120 ms à 125 BPM) pour un pompage qui respire avec le groove.",
  },
  cmake: {
    section: 'GLOBAL FX · COMP',
    title: 'MAKEUP',
    lock: 'global',
    text: "Le gain rendu après la compression. Tout en bas, AUTO (le départ) : un gain fixe, calculé du seuil et du rapport (il s'affiche sous AUTO), qui garde le motif au même volume ; il ne bouge jamais tout seul, rien ne respire. Au-dessus, à la main, de -6 à +18 dB.",
    tip: "Laisse AUTO pour comparer honnêtement (COMP à 0, puis remonté) ; à la main, quelques dB de plus pour qu'un kit écrasé passe devant.",
  },
  chpf: {
    section: 'GLOBAL FX · COMP',
    title: 'HPF',
    lock: 'global',
    text: "Le passe-haut de la chaîne latérale du COMP : ce que son détecteur écoute, pas ce que tu entends. OFF : tout, le kick entier fait compresser le reste ; 60 Hz (le départ) : le sub du kick ne tire plus le bus vers le bas ; 120 Hz : le kick le fait à peine réagir, la caisse claire et les charleys le guident.",
    tip: "OFF avec un RELEASE court : le pompage disco marqué à chaque kick ; 120 Hz pour une colle discrète qui laisse le kick rond.",
  },
  cknee: {
    section: 'GLOBAL FX · COMP',
    title: 'KNEE',
    lock: 'global',
    text: "Le genou du COMP : la largeur autour du seuil où la compression arrive en douceur, de 0 (HARD : d'un coup, au seuil) à 12 dB ; 6 dB au départ. Il n'a pas de case sur la page (COMP en prend deux, les six autres réglages le reste) : il se règle au MIDI (rytm:enc:cknee) et au Roto-Control.",
    tip: "Doux (6 à 12 dB) pour un bus qui colle sans qu'on l'entende ; dur (0 à 2 dB) pour un compresseur qui mord, façon API.",
  },

  /* ---------- la plaque TWEAKS (OPEN) : les choix de son ---------- */
  'r:bd': {
    section: 'VOICE',
    title: 'KICK',
    text: "Le son du kick : 909, 808 ou MM (la synthèse seule, remise à fond, le sample coupé), puis les samples de Mika, chacun à son nom (le sample seul, la synthèse à 0). Il se choisit à l'écran : touche le nom du son (SOUND, sur VOICE quand BD est choisi), toute la liste s'ouvre ; au MIDI, rytm:kit:bd. Pour un sample et une machine ensemble : MIX (VOICE SYNTH). Tous sortent à la même crête : changer de kick ne change pas le niveau.",
    tip: '909 pour une techno qui claque, 808 pour un minimal rond et long, un sample de Mika pour l’indie dance.',
  },
  'r:sd': {
    section: 'VOICE',
    title: 'SNARE',
    text: "Le son de la caisse claire : 909, 808 ou MM (la synthèse seule, à fond), puis les samples de Mika (le sample seul). À l'écran (SOUND, sur VOICE quand SD est choisi) et au MIDI (rytm:kit:sd). SNAPPY, sous le capot (OPEN), règle son timbre, synthèse et sample ; pour les deux couches ensemble, MIX (VOICE SYNTH).",
    tip: 'MM avec GATE sur ON pour la dark disco des années 80.',
  },
  'r:cp': {
    section: 'VOICE',
    title: 'CLAP',
    text: "Le son du clap : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). À l'écran (SOUND, sur VOICE quand CP est choisi) et au MIDI (rytm:kit:cp). GATE (OPEN) lui donne sa petite pièce en MM et en 909.",
    tip: '909 avec GATE sur ON : le clap large de la dark disco ; 808, sec et court, pour un minimal.',
  },
  'r:ch': {
    section: 'VOICE',
    title: 'CL HAT',
    text: "Le son du charley fermé, CH : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). À l'écran (SOUND, sur VOICE quand CH est choisi) et au MIDI (rytm:kit:ch) ; OH a son propre choix.",
    tip: '808 pour un minimal métallique, 909 pour une house qui respire.',
  },
  'r:oh': {
    section: 'VOICE',
    title: 'OP HAT',
    text: "Le son du charley ouvert, OH : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). Au départ, OH joue le premier sample de Mika, un vrai open hat de ses projets, la synthèse à 0 ; il sort un peu au-dessus du charley fermé et bien sous le kick. Le MM, refait le 2026-10-18, souffle comme une vraie cymbale et s'éteint tout seul. À l'écran (SOUND, sur VOICE quand OH est choisi) et au MIDI (rytm:kit:oh).",
    tip: 'Un 909 ouvert sur les contretemps au-dessus d’un CH 808 : la house qui respire ; le sample de Mika, plus court, pour une techno serrée.',
  },
  'r:tom': {
    section: 'VOICE',
    title: 'TOM',
    text: "Le son du tom grave, TOM : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). À l'écran (SOUND, sur VOICE quand TOM est choisi) et au MIDI (rytm:kit:tom) ; HT a son propre choix.",
    tip: '808 pour des toms ronds de dark disco ; MM, plus courts, pour une ligne de percussions minimal accordée en P-LOCK.',
  },
  'r:ht': {
    section: 'VOICE',
    title: 'HI TOM',
    text: "Le son du tom aigu, HT : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (toms aigus, percussions, congas, rims ; le sample seul). À l'écran (SOUND, sur VOICE quand HT est choisi) et au MIDI (rytm:kit:ht).",
    tip: 'HT en 909 au-dessus d’un TOM 808 : deux timbres pour une relance de toms.',
  },
  'r:cy': {
    section: 'VOICE',
    title: 'CYMBAL',
    text: "Le son de la cymbale, CY : sa synthèse (909, 808 et MM donnent aujourd'hui le même son calculé), puis ses samples (cymbales, crashs, rides ; le sample seul). À l'écran (SOUND, sur VOICE quand CY est choisi) et au MIDI (rytm:kit:cy).",
    tip: 'Un crash de Mika sur le premier pas, verrouillé plus doux en P-LOCK sur le neuvième : la mesure respire.',
  },

  /* ---------- un potard de la face sans bloc sur sa case (2026-10-27, les potards suivent la page) ---------- */
  'knob:empty': {
    section: 'KEYS',
    title: 'KNOB',
    text: "Rien sur cette page sous ce potard. Chaque potard à droite de l'écran tourne la valeur posée à la même place sur l'écran (A en haut à gauche, E en bas à gauche) : une case vide à l'écran, un potard qui ne fait rien. Change de page (VOICE, FLTR, ENV, FX) : les huit potards suivent. Un pas tenu : ils posent son P-LOCK ; une scène armée (SCENE A ou B) : ils écrivent dans la scène ; le crossfader : leurs anneaux montrent ce qu'on entend, en lueur la bande entre A et B.",
  },

  /* ---------- TRK, la touche des voix (2026-10-27, la phase 2, Mika : "comme la DIGITAKT") ---------- */
  trk: {
    section: 'KEYS',
    title: 'TRK',
    text: "La touche des voix, comme sur une Digitakt : la première de la rangée, TRK écrit dessus. Tiens TRK et touche un pas de 1 à 8 : il choisit sa voix, BD SD CH OH CP TOM HT CY (le nom imprimé sur le pas), sans un son, même à l'arrêt ; l'écran et les huit potards passent à elle. Une tape sur TRK la garde allumée jusqu'au choix d'une voix (une seule main suffit, à la souris) ; une autre tape, Échap ou une touche A à V l'éteint. Les pas 9 à 16 ne font rien avec TRK (réservés). TRK passe avant EDIT et le P-LOCK : EDIT ouvert, un pas choisit quand même sa voix et EDIT reste ouvert. Deux tapes rapides sur le même pas (ou un clic droit) coupent sa voix ou la rendent, sans la choisir ; une voix coupée reste à peine allumée avec une barre rouge, une voix en solo a une barre bleue. Les huit carrés sont de la même couleur, la voix choisie plus forte ; pendant la lecture, chacun flashe à l'instant où sa voix frappe (une voix coupée ne flashe pas). En mode SOLO ou MUTE, le pas met sa voix en solo ou la coupe. Au clavier : Tab jusqu'à TRK, Espace ou Entrée la garde, puis Entrée sur un pas. Au Roto-Control (RSEQ), TRK allumée, les huit boutons choisissent les huit voix.",
    tip: "Une tape sur TRK, puis le pas 2 : SD est choisie, les potards règlent la caisse claire ; une tape encore, puis le pas 3 : le charley, sans quitter la page.",
  },

  /* ---------- SCENE A et B (2026-10-27, la phase 2) ; le crossfader, visible et inerte jusqu'a P2-20 ---------- */
  scene: {
    section: 'SCENES',
    title: 'SCENE A / B',
    text: "Deux scènes de réglages par pattern, comme sur un Octatrack. Tiens SCENE A (ou B) et tourne un potard, un bloc de l'écran ou un potard MIDI : la valeur va dans la scène, jamais dans le son de base ; lâche, c'est fini. Une tape garde la scène armée (sa touche allumée, son cadre clignote) jusqu'à une autre tape, Échap ou CLEAR. Pendant ce temps les anneaux montrent la scène : clair, un réglage déjà dans la scène ; à moitié, un réglage qui s'y mettra au premier cran ; à peine, ce qui n'entre pas dans une scène (SOUND, les choix de son, les TWEAKS pour l'instant). TEMPO, MASTER, les mutes et RUN restent ceux de toujours. Un pas tenu gagne : le potard pose son P-LOCK. Deux tapes ou Suppr sur un potard retirent sa valeur de la scène ; SCENE + CLEAR vide la scène armée, l'autre reste ; CLEAR seul vide les deux avec le pattern. Une scène garde 64 réglages au plus ; elle vit avec son pattern (A01 a les siennes, A02 les siennes). Son témoin s'allume quand elle a des valeurs.",
    tip: "Page GLOBAL FX : tiens SCENE B, monte DELAY et REVERB, lâche. La scène B a deux réglages ; le crossfader les fera entendre.",
  },
  xfade: {
    section: 'SCENES',
    title: 'CROSSFADER',
    text: "De la scène A (à gauche) à la scène B (à droite), comme sur un Octatrack : glisse le capuchon (il part d'où il est, rien ne saute ; Maj, dix fois plus fin) ou tourne la molette au-dessus de la fente (un cran, 1 sur 127). Chaque réglage d'une scène va en douceur de sa valeur A à sa valeur B ; un réglage dans une seule scène part de sa valeur de base. Les anneaux montrent ce qu'on entend et, en lueur, la bande entre A et B ; les blocs de l'écran portent un coin A, B ou AB ; le pied dit A [---|---] B. Les témoins de SCENE A et B disent combien on entend de chacune. Rien ne s'enregistre : le crossfader revient à A à chaque visite, il ne touche ni le pattern, ni UNDO. Au clavier : Tab jusqu'au crossfader, puis les flèches, Page haut et bas, Début et Fin.",
    tip: "Scène A vide, scène B avec DELAY et REVERB montés : pousse le crossfader pendant que ça joue, l'écho et l'espace arrivent ; reviens à gauche, le son sec revient.",
  },

  /* ---------- les reglages a venir (l'etude, sur aucun ecran) ---------- */
  'soon:prob': {
    section: 'VOICE',
    title: 'PROB',
    text: "Bientôt : la probabilité qu'un pas joue, de 0 à 100 % ; un charley à 50 % ne tombe qu'une fois sur deux, au hasard.",
    tip: 'Des charleys à 70 ou 80 % : un minimal qui ne se répète jamais tout à fait.',
  },
  'soon:micro': {
    section: 'VOICE',
    title: 'MICRO',
    text: 'Bientôt : décale un pas un peu avant ou après la grille, plus finement que SWING, pas par pas.',
    tip: 'Une caisse claire un rien en retard : la dark disco qui traîne.',
  },
  'soon:cond': {
    section: 'VOICE',
    title: 'COND',
    text: "Bientôt : une condition de pas, comme sur une Elektron : jouer une mesure sur deux (1:2), seulement la quatrième (4:4)...",
    tip: 'Un crash de CY en 1:4 : il ne tombe qu’au début de chaque phrase.',
  },
  'soon:rtrg': {
    section: 'VOICE',
    title: 'RTRG',
    text: 'Bientôt : le retrig, le pas répété plusieurs fois dans sa durée (des roulements de caisse claire, des charleys en rafale).',
  },
  'soon:rtim': {
    section: 'VOICE',
    title: 'RTIM',
    text: "Bientôt : la vitesse du retrig (1/16, 1/32...).",
  },
  'soon:br': {
    section: 'VOICE',
    title: 'BR',
    text: 'Bientôt : la réduction de bits, le grain des vieux samplers.',
  },
  'soon:loop': {
    section: 'VOICE',
    title: 'LOOP',
    text: "Bientôt : l'échantillon joué en boucle tant que le coup dure.",
  },

  /* ---------- l'etape R3 : les couches SYNTH et SAMPLE, comme l'Analog Rytm ---------- */
  'r3:machine': {
    section: 'VOICE SYNTH',
    title: 'MACHINE',
    lock: 'yes',
    voice: {
      ch: { tip: 'CH et OH ont chacun leur MACHINE depuis le 2026-10-18 : un 808 fermé sous un 909 ouvert, ou un 909 verrouillé sur les seuls contretemps.' },
      cy: {
        text: "La MACHINE de la cymbale : 909, 808 et MM donnent aujourd'hui le même son calculé (sa synthèse à elle). MIX, à côté, la dose sous un sample de cy. En P-LOCK, un pas de CY peut prendre le sample d'une autre voix (SOUND, sur VOICE).",
        tip: 'Un kick de Mika verrouillé sur le dernier pas de CY : un coup sourd à la place du crash.',
      },
    },
    tip: 'Un 808 sur les pas 4 et 12 seulement (P-LOCK) : un kick long qui répond au 909 du reste de la mesure.',
    text: "Le type de la couche SYNTH de la voix : 909, 808 ou MM, calculé par la machine (pas un sample). Comme sur l'Analog Rytm, cette synthèse et le sample jouent ensemble, chacun à son niveau (MIX, à côté), puis passent par la même voix (FLTR, ENV, FX). Changer de MACHINE ne touche ni au sample ni aux niveaux ; quand la synthèse se tait (MIX à +63), l'écran le rappelle. En P-LOCK, un pas peut jouer une autre machine.",
  },
  'r3:synlevel': {
    section: 'VOICE SYNTH',
    title: 'LEVEL',
    lock: 'yes',
    tip: "Le kick de Mika à 127 et le 909 vers 50 : le grave de la machine sous l'attaque du sample.",
    text: "Le niveau de la couche SYNTH, de 0 (OFF, seul le sample joue) à 127 (la synthèse calée à son niveau). Les deux couches à fond peuvent dépasser la crête de la voix : elles sont alors ramenées dessous, jamais remontées ; le kick reste la référence du mix. Au départ, BD, SD et OH sont à 0 : leur sample joue seul. Sur l'écran, MIX (VOICE SYNTH) règle les deux niveaux d'un geste.",
  },
  'r3:sweep': {
    section: 'VOICE SYNTH',
    title: 'SWEEP',
    lock: 'yes',
    tip: 'Plus de SWEEP pour une techno qui claque ; presque rien pour un kick rond de dark disco qui laisse le grave à la basse.',
    text: "La descente de hauteur du kick de synthèse, sa profondeur : de rien (un sinus qui ne descend pas) à deux fois celle d'origine (64) ; la ligne du dessous dit de combien d'octaves il tombe. En 909 la descente est rapide et profonde, en 808 courte, en MM entre les deux.",
  },
  'r3:sdtune': {
    section: 'VOICE SYNTH',
    title: 'TUNE',
    lock: 'yes',
    tip: 'Une caisse claire un peu plus grave pour la dark disco ; plus aiguë pour une électro sèche.',
    text: "La hauteur de la peau de la caisse claire de synthèse, ±12 demi-tons autour de sa note (185 Hz en MM, 175 Hz en 909, 238 Hz en 808) ; la ligne du dessous donne les Hz. Le timbre (le bruit) ne bouge pas ; PITCH (VOICE) accorde toute la voix.",
  },
  'r3:sddecay': {
    section: 'VOICE SYNTH',
    title: 'DECAY',
    lock: 'yes',
    text: "La longueur de la caisse claire de synthèse : sa peau et son timbre ensemble, de 0,42 à 2,4 fois celle d'origine (64) ; la ligne du dessous donne sa tenue. DEC (ENV) peut encore la couper après coup.",
    tip: 'Courte (vers 40) pour un minimal sec ; longue (vers 90) avec GATE sur ON pour la dark disco.',
  },
  'r3:sdtone': {
    section: 'VOICE SYNTH',
    title: 'TONE',
    lock: 'yes',
    tip: 'Un TONE un peu haut et SNAPPY à 80 : la caisse claire qui perce en indie dance.',
    text: "La couleur du timbre de la caisse claire de synthèse : son passe-haut, une octave plus bas (plus sourde) ou plus haut (plus brillante) ; la ligne du dessous donne sa fréquence.",
  },
  'r3:stune': {
    section: 'VOICE',
    title: 'S.TUNE',
    lock: 'yes',
    tip: 'Accorde le kick de Mika sur la tonique du morceau, puis la synthèse sur la même note.',
    text: "La hauteur de la seule couche SAMPLE, au demi-ton, de -24 à +24 (au MIDI ; un verrou d'avant l'étape 2 la garde). Le sample est relu plus vite ou plus lentement : plus aigu, il est aussi plus court. Sur l'écran, PITCH et FINE (VOICE) accordent toute la voix.",
  },
  'r3:sfine': {
    section: 'VOICE',
    title: 'S.FINE',
    lock: 'yes',
    text: "L'accord fin de la seule couche SAMPLE, de -64 à +64 cents (au MIDI ; un verrou d'avant l'étape 2 le garde). Sur l'écran, FINE (VOICE) accorde toute la voix.",
    tip: 'Quelques cents pour caler le kick de Mika juste sur la note du MM-BASS : en minimal, le grave ne bat plus.',
  },
  'r3:sstart': {
    section: 'VOICE',
    title: 'S.START',
    lock: 'yes',
    text: "Où la seule couche SAMPLE commence dans son fichier, de 0 (FROM TOP) à 90 % (au MIDI ; un verrou d'avant l'étape 2 le garde) ; LEN se compte depuis là. Sur l'écran, START (ENV) fait partir tout le coup plus loin, ses deux couches ensemble.",
    tip: 'Un START vers 20 % verrouillé sur un pas de caisse claire : il perd son attaque, une note fantôme sans changer de son.',
  },
  'r3:send': {
    section: 'VOICE',
    title: 'LEN',
    lock: 'yes',
    tip: "Un LEN court sur le kick : la queue du sample s'arrête juste avant la basse.",
    text: "La part du sample gardée après son début, de 12 % à tout le fichier (FULL) : le coup garde tout son corps jusque-là, puis s'éteint en un fondu court (6 à 25 ms). La ligne du dessous donne où il s'arrête, en ms. Il ne règle que le sample : DEC (ENV) coupe toute la voix.",
  },
  'r3:smplevel': {
    section: 'VOICE SYNTH',
    title: 'LEVEL',
    lock: 'yes',
    text: "Le niveau de la couche SAMPLE, de 0 (OFF) à 127 (le sample calé à son niveau). Sample sur OFF ou niveau à 0 : seule la synthèse joue. Les deux couches à fond sont ramenées sous la crête de la voix. Sur l'écran, MIX (VOICE SYNTH) règle les deux niveaux d'un geste.",
    tip: "Le sample vers 100 et la synthèse dessous : l'attaque du fichier, le corps de la machine, pour l'indie dance.",
  },
  'r3:reverse': {
    section: 'VOICE',
    title: 'REV',
    lock: 'yes',
    tip: "Un pas de caisse claire à l'envers (P-LOCK) juste avant le temps : le souffle qui aspire la mesure.",
    text: "Le sample joué à l'envers (ON) : le fichier part de sa fin ; LEN se compte alors depuis là.",
  },

  /* ---------- les pads des voix ---------- */
  'pad:BD': {
    section: 'VOICES',
    title: 'BD',
    text: "Le kick, la référence du mix : il sort le plus fort, les autres voix sont calées sous sa crête. Il a sa propre voie (les FX globaux ne le touchent pas, il a les siens dans VOICE FX) et il est monophonique : un nouveau coup coupe la queue du précédent en 3 ms. Le pad le choisit : les pas et l'écran le règlent ; à l'arrêt, il le joue aussi, à la vélocité des nouveaux pas (HIGH au départ). Le dessin montre ce qu'il joue et ses 16 pas.",
    key: 'A',
    tip: 'Choisis la voix avant de toucher les pas : ils montrent et changent sa rangée.',
  },
  'pad:SD': {
    section: 'VOICES',
    title: 'SD',
    text: "La caisse claire : sa crête reste au moins 1,5 dB sous celle du kick. Le pad la choisit : les pas et l'écran la règlent ; à l'arrêt, il la joue aussi.",
    key: 'S',
    tip: 'Sur 5 et 13 pour l’indie dance ; une ghost note plus douce (VOL verrouillé) sur le 15 fait rouler la mesure.',
  },
  'pad:CH': {
    section: 'VOICES',
    title: 'CH',
    text: "Le charley fermé : il coupe le charley ouvert qui sonne encore, en 8 ms, comme une 808. Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'D',
    tip: 'Des doubles croches à 85 et un 127 sur chaque temps : le moteur de l’indie dance.',
  },
  'pad:OH': {
    section: 'VOICES',
    title: 'OH',
    text: "Le charley ouvert ; le prochain charley, fermé ou ouvert, le coupe en 8 ms. Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'F',
    tip: 'OH sur les contretemps et CH partout ailleurs : le charley ouvert se ferme tout seul, la house classique.',
  },
  'pad:CP': {
    section: 'VOICES',
    title: 'CP',
    text: "Le clap : sa crête reste au moins 3,5 dB sous celle du kick. Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'Z',
    tip: 'Avec la caisse claire sur 5 et 13 : la dark disco ; seul et plus bas, il suffit à un minimal.',
  },
  'pad:TOM': {
    section: 'VOICES',
    title: 'TOM',
    text: "Le tom grave ; TOM et HT partagent leur son (TOMS). Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'X',
    tip: 'Deux ou trois coups accordés en P-LOCK (PITCH) : une ligne de percussions pour le minimal.',
  },
  'pad:HT': {
    section: 'VOICES',
    title: 'HT',
    text: "Le tom aigu ; TOM et HT partagent leur son (TOMS). Le pad le choisit ; à l'arrêt, il le joue aussi.",
    key: 'C',
    tip: 'HT sur le dernier temps, en réponse au TOM : le petit roulement de la dark disco.',
  },
  'pad:CY': {
    section: 'VOICES',
    title: 'CY',
    text: "La cymbale, en stéréo large (sa gauche et sa droite ont leurs propres phases), la plus discrète du kit (sa crête est la plus basse) ; un seul son. Le pad la choisit ; à l'arrêt, il la joue aussi.",
    key: 'V',
    tip: 'Une CY au début de chaque phrase seulement : l’indie dance garde son souffle.',
  },

  /* ---------- les pas et le P-LOCK ---------- */
  step: {
    section: 'STEPS',
    title: 'STEPS',
    text: "Les 16 pas de la voix choisie. Un pas mis s'allume en entier, plein à la vélocité la plus forte (127, HIGH), de plus en plus sombre jusqu'à la plus douce (14) ; un pas vide reste éteint. Touche un pas vide : il prend la vélocité des nouveaux pas (HIGH au départ) ; touche-le encore : MID, LOW, vide. Tiens-le et glisse vers le haut ou le bas : sa vélocité, en neuf niveaux, la touche suit. Tiens-le 350 ms sans bouger (ou L) : P-LOCK. Au doigt, tiens un pas d'un doigt et glisse une valeur de l'écran d'un autre : le verrou se pose tout de suite. Un pas qui porte des verrous a un trait sur sa touche, près du bord arrière, et un point dessous à l'écran. Dans EDIT, les 16 pas sont les 16 patterns. Les noms BD à CY imprimés sur les pas 1 à 8 : TRK tenue ou gardée, un pas choisit sa voix (9 à 16, rien). Un pas tenu gagne sur une scène armée : les potards à droite de l'écran posent son P-LOCK, la scène ne change pas.",
    tip: 'Le kick sur 1, 5, 9 et 13 (les pas encadrés), le clap ou la caisse claire sur 5 et 13 : la base du four on the floor.',
    phone: {
      text: "Les 16 pas de la voix choisie. Un pas mis s'allume en entier, plein à la vélocité la plus forte (127, HIGH), de plus en plus sombre jusqu'à la plus douce (14) ; un pas vide reste éteint. Touche un pas vide : il prend la vélocité des nouveaux pas (HIGH au départ) ; touche-le encore : MID, LOW, vide. Tiens-le et glisse vers le haut ou le bas : sa vélocité, en neuf niveaux, la touche suit. Tiens-le 350 ms sans bouger : P-LOCK. Ou tiens un pas d'un doigt et glisse une valeur de l'écran d'un autre : le verrou se pose tout de suite. Un pas qui porte des verrous a un trait sur sa touche, près du bord arrière, et un point dessous à l'écran. Dans EDIT, les 16 pas sont les 16 patterns.",
    },
    voice: {
      none: {
        text: PHONE
          ? "Les 16 pas de la voix choisie : touche d'abord un pad (l'écran dit TAP A PAD FIRST). Ensuite, une touche sur un pas vide le pose à la vélocité des nouveaux pas (HIGH au départ) ; tenu 350 ms : P-LOCK."
          : "Les 16 pas de la voix choisie : choisis d'abord une voix au clavier, A S D F et Z X C V (l'écran dit PICK A VOICE FIRST). Ensuite, une touche sur un pas vide le pose à la vélocité des nouveaux pas (HIGH au départ) ; tenu 350 ms : P-LOCK.",
      },
    },
  },
  lock: {
    section: 'STEPS',
    title: 'P-LOCK',
    steps: [
      "Tiens un pas 350 ms (ou L) : il passe en P-LOCK, l'en-tête de l'écran devient P-LOCK STEP 05.",
      "Choisis la page, tourne le potard d'une valeur (ou sa molette) : ce réglage ne change que sur ce pas, son bloc passe en négatif, un P dans son coin.",
      'Retape le pas (ou Échap) pour sortir.',
    ],
    text: "Le parameter lock d'une Elektron : un pas garde sa propre valeur d'un réglage, et l'écran la montre quand le pas joue (la pastille P-LOCK clignote pendant la lecture). Chaque page compte ses verrous ; deux clics sur une valeur enlèvent son verrou, CLEAR tous ceux du pas. Les huit potards à droite de l'écran tournent les valeurs de la page à leur place : un pas tenu (ou en P-LOCK), ils posent son verrou, sur la page montrée ; leurs anneaux passent au jaune du LOCK. Un pas tenu gagne sur une scène armée ; garder le P-LOCK (un pas lâché sans tourner) désarme une scène gardée, armer une scène quitte le P-LOCK. Dans le Dock, un appui long sur le pas, puis KNOBS.",
    tip: 'Un sample lock : en P-LOCK sur le pas 16 de BD, glisse SOUND (VOICE) jusqu’à une caisse claire de Mika ; la mesure finit sur elle, calée à son niveau.',
    phone: {
      steps: [
        "Tiens un pas 350 ms : il passe en P-LOCK, l'en-tête de l'écran devient P-LOCK STEP 05.",
        "Choisis la page, glisse une valeur de l'écran de haut en bas : ce réglage ne change que sur ce pas, son bloc passe en négatif, un P dans son coin.",
        'Retape le pas pour sortir.',
      ],
      text: "Le parameter lock d'une Elektron : un pas garde sa propre valeur d'un réglage, et l'écran la montre quand le pas joue (la pastille P-LOCK clignote pendant la lecture). Chaque page compte ses verrous ; deux tapes sur une valeur enlèvent son verrou, CLEAR tous ceux du pas. À deux doigts, plus vite : un sur le pas, l'autre glisse la valeur ; dans le Dock, un appui long sur le pas, puis KNOBS. Les huit encodeurs sous l'écran restent les FX globaux : ils ne verrouillent jamais.",
    },
  },

  /* ---------- le transport ---------- */
  run: {
    section: 'TRANSPORT',
    title: 'RUN/STOP',
    text: "Lance ou arrête le séquenceur du MM-RYTM ; une piste SoundCloud qui joue passe en pause. Le MM-BASS et le MM-ARP se calent sur sa grille quand ils jouent. En lecture, une voix choisie au clavier (A S D F, Z X C V) ne joue pas : elle est seulement choisie. Sur la touche, les signes PLAY et STOP, comme sur une Digitakt ; elle s'allume pendant la lecture.",
    phone: {
      text: "Lance ou arrête le séquenceur du MM-RYTM ; une piste SoundCloud qui joue passe en pause. Le MM-BASS et le MM-ARP se calent sur sa grille quand ils jouent. En lecture, toucher un pad choisit sa voix sans la jouer.",
    },
    key: 'Espace',
  },
  clear: {
    section: 'TRANSPORT',
    title: 'CLEAR',
    text: "Vide les 16 pas de toutes les voix, et leurs verrous ; la lecture continue. Tous les effets passent à zéro (GLOBAL FX et ceux de chaque voix) et chaque voix repart d'un son de base : VOICE, FLTR et ENV au neutre (attaque nette, toute la queue, filtre ouvert), les réglages de la machine (OPEN) à leur départ ; le son choisi (SOUND) reste. UNDO revient à avant. En P-LOCK, n'efface que les verrous du pas, ses coups restent.",
  },
  random: {
    section: 'TRANSPORT',
    title: 'RANDOM',
    text: "Compose un motif 4x4 neuf pour toutes les voix dans un style (HOUSE, DEEP HOUSE, TECH HOUSE, TECHNO, MINIMAL, INDIE DANCE, DARK DISCO, ITALO, PROG ou ELECTRO), jamais deux fois le même style de suite : le kick reste sur les quatre temps, le reste change à chaque appui (backbeat, charleys en croches, doubles croches, galop ou euclidiens, percussions euclidiennes, roulements, ride ou crash, vélocités sur neuf niveaux) et le motif s'éloigne toujours du précédent. Le SWING suit le style ; chaque voix, le kick compris, prend aussi un autre son de sa liste SOUND (le plus souvent un sample, sinon 909, 808 ou MM) ; TONE, VOL, DECAY et PAN sont tirés pour chaque voix sauf le kick. Le tempo, les autres effets, les autres réglages des voix et les verrous restent ; UNDO revient au motif et aux sons d'avant. Pour choisir un son toi-même, touche le nom du son (SOUND, page VOICE), toute la liste de la voix s'ouvre ; au desktop, un WAV glissé sur la machine y entre aussi.",
    tip: 'Appuie jusqu’à ce qu’un groove t’accroche, puis garde-le dans un pattern avec EDIT.',
  },
  mute: {
    section: 'TRANSPORT',
    title: 'MUTE',
    text: "Une tape sur MUTE, puis une voix, au clavier (A S D F, Z X C V) ou TRK et son pas (1 à 8) : elle se coupe, ou revient ; deux tapes sur MUTE, plusieurs voix ; une tape de plus, le mode se range et les voix coupées le restent. Des voix coupées, le mode rangé : une tape sur MUTE les rend toutes ; tenu 600 ms, toutes les voix reviennent. Sans armer MUTE : TRK (tenue ou gardée d'une tape), puis deux tapes rapides sur le pas de la voix, ou TRK et un clic droit sur le pas. Au MIDI, rytm:pad:BD fait comme la touche A, et rytm:voice:BD:mute coupe la voix d'un coup (de même pour les autres). TRK montre une voix coupée à peine allumée, avec une barre rouge. Une voix coupée ne joue ni ses pas ni ses verrous ; choisie, elle se règle sans s'entendre, et tu entends le changement quand tu la rends. Les mutes n'entrent jamais dans une scène : une scène armée, MUTE et le mute d'une voix restent ceux de toujours.",
    phone: {
      text: "Un clic droit sur un pad (au doigt : deux tapes rapides) coupe sa voix, ou la rend ; autant de voix que tu veux. Une tape sur MUTE : toutes les voix reviennent. Une voix coupée a son pad rouge, ses pas et ses verrous ne jouent pas ; une tape sur son pad la choisit sans la rendre ni la jouer : tu la règles sans l'entendre, et tu entends le changement quand tu la rends.",
    },
    key: 'M',
    tip: PHONE
      ? 'En live : coupe le kick et les charleys d’un clic droit, prépare-les en silence, puis MUTE : tout revient d’un coup.'
      : 'En live, au Roto-Control : coupe le kick et les charleys, prépare-les en silence, puis MUTE : tout revient d’un coup.',
  },
  solo: {
    section: 'TRANSPORT',
    title: 'SOLO',
    text: "Une tape sur SOLO, puis une voix au clavier (A S D F, Z X C V) : elle joue seule ; deux tapes sur SOLO, plusieurs voix ; une tape de plus, le mode se range et le solo reste ; tenu 600 ms, toutes les voix reviennent. Le solo et les mutes sont deux listes à part : sortir du solo rend les mutes d'avant.",
    phone: {
      text: "Comme MUTE, mais la voix touchée joue seule (son pad passe en bleu) : une tape, une voix ; deux tapes, plusieurs ; une tape de plus, le mode se range et le solo reste ; tenu 600 ms, toutes les voix reviennent. Le solo et les mutes sont deux listes à part : sortir du solo rend les mutes d'avant.",
    },
    key: 'Maj + M',
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
    text: "Soulève le capot : la plaque TWEAKS règle la machine (le KICK : SYN TUNE, ATTACK, SYN DECAY et DRIVE ; la caisse claire : SNAPPY et GATE). Le son de chaque voix se choisit à l'écran (SOUND, sous HOME ou page VOICE) ou au MIDI (rytm:kit:<voix>). La musique continue. Capot ouvert, l'écran part avec le panneau : la pastille INFOS, en haut à gauche, allume l'aide pour lire la plaque.",
    key: 'O',
  },
  close: {
    section: 'TWEAKS',
    title: 'CLOSE',
    text: 'Referme le capot du MM-RYTM.',
    key: 'O ou Échap',
  },

  /* ---------- MASTER et TEMPO ---------- */
  level: {
    section: 'MASTER',
    title: 'MASTER',
    text: "Le volume de tout le MM-RYTM, voix et effets compris (les envois REVERB et DELAY suivent) : un gain au carré, -3,9 dB au réglage d'usine (102), 0 dB tout en haut. Il est dans l'écran, en haut à droite, à gauche du tempo (sur HOME et dans la vue PAGE) : sept barres qui montent avec lui, son niveau en dB à côté quand la place le permet. Il se règle au potard A de la page MASTER (FX pressée trois fois : GLOBAL FX, VOICE FX, MASTER) : glisse-le de haut en bas (Maj : plus fin), ou sa molette ; deux clics le remettent à -3,9 dB ; le pied de l'écran dit sa valeur. Il ne touche ni le MM-BASS, ni le MM-ARP, ni le volume du site.",
    tip: 'Règle MASTER une fois, puis équilibre les machines au MIXER du MM-DECKS (voie 1).',
    phone: {
      text: "Le volume de tout le MM-RYTM, voix et effets compris (les envois REVERB et DELAY suivent) : un gain au carré, -3,9 dB au réglage d'usine (102), 0 dB tout en haut. Il est dans l'écran, en haut à droite, à gauche du tempo (sur HOME et dans la vue PAGE) : sept barres qui montent avec lui, son niveau en dB à côté quand la place le permet. Glisse-le de haut en bas, il se cerne tant que tu le tiens ; deux tapes le remettent à -3,9 dB ; le pied de l'écran dit sa valeur. Il ne touche ni le MM-BASS, ni le MM-ARP, ni le volume du site.",
    },
  },
  tempo: {
    section: 'TEMPO',
    title: 'TEMPO',
    text: "Le tempo de tout le studio, de 100 à 150 BPM : le MM-BASS et le MM-ARP le suivent. Il est dans l'écran, en haut à droite, à côté du i (sur HOME et dans la vue PAGE) : son nombre et sa course dessous. Il se règle au potard B de la page MASTER (FX pressée trois fois : GLOBAL FX, VOICE FX, MASTER) : glisse-le vers le haut pour accélérer (Maj : plus fin), sa molette va de 1 BPM, deux clics le remettent à 130 ; son bloc dit 128 BPM. Le DELAY suit ce tempo (TIME, sur sa page de GLOBAL FX).",
    phone: {
      text: "Le tempo de tout le studio, de 100 à 150 BPM : le MM-BASS et le MM-ARP le suivent. Il est dans l'écran, en haut à droite, à côté du i (sur HOME et dans la vue PAGE) : son nombre et sa course dessous. Glisse-le vers le haut pour accélérer (100 px = 50 BPM), il se cerne tant que tu le tiens ; deux tapes le remettent à 130 ; le pied de l'écran dit TEMPO 128 BPM. Le DELAY suit ce tempo (TIME, sur sa page de GLOBAL FX).",
    },
    tip: '118 à 124 BPM pour l’indie dance et la dark disco, 124 à 128 pour le minimal et la house, 130 et plus pour la techno.',
  },

  /* ---------- l'ecran ---------- */
  screen: {
    section: 'SCREEN',
    title: 'SCREEN',
    text: "La vue PAGE, l'éditeur ; il ne se touche pas, il montre ce que font les potards et les touches. En haut, la page en pastille et ses onglets, la voix, le pattern, MASTER et TEMPO (leurs potards A et B sur la page MASTER, FX pressée trois fois) et le i des INFOS (I au clavier) ; en P-LOCK, l'en-tête passe en négatif (P-LOCK STEP 05) et compte les verrous. Puis les blocs, à la place des anciens encodeurs (SOUND en grand, l'enveloppe dessinée sur trois cases) : chacun avec sa valeur de 0 à 127 (de -64 à +63 pour un réglage centré, le nom du cran pour un choix), son unité et son petit dessin. Le potard à la place d'un bloc le règle (glisse-le de haut en bas, ou sa molette) ; deux clics sur le potard le remettent à son départ, une tape ouvre ce qu'ouvrait le bloc (la page d'un FX de GLOBAL FX ou VOICE FX, la liste des sons sur SOUND) ; le bloc se cerne au survol du potard. Dessous, les 16 pas de la voix et la tête de lecture, un point sous chaque pas verrouillé. Les huit encodeurs à droite de l'écran règlent les FX globaux. Le reste de l'en-tête ouvre les presets ; la touche de page allumée passe à son onglet suivant, ou montre HOME (H).",
    phone: {
      text: "La vue PAGE, l'éditeur. En haut, la page en pastille et ses onglets, la voix, le pattern, MASTER et TEMPO (à glisser) et le i des INFOS ; en P-LOCK, l'en-tête passe en négatif (P-LOCK STEP 05) et compte les verrous. Puis les blocs (SOUND en grand, l'enveloppe dessinée sur trois cases), chacun avec sa valeur de 0 à 127 (de -64 à +63 pour un réglage centré, le nom du cran pour un choix), son unité et son petit dessin. Glisse un bloc de haut en bas pour le régler (environ 150 px pour toute la course, il se cerne tant que tu le tiens), deux tapes le remettent à son départ. Dessous, les 16 pas de la voix et la tête de lecture. Les huit encodeurs sous l'écran règlent les FX globaux. Le reste de l'en-tête ouvre les presets ; la touche de page allumée passe à son onglet suivant, ou montre HOME.",
    },
  },
  presets: {
    section: 'SCREEN',
    title: 'PRESETS',
    text: "Les presets du MM-RYTM : EDIT deux fois (les patterns, puis les presets), ou P au clavier. Une liste, tes presets (MIKA/DEEP KICK) puis ceux d'usine : le potard A la fait défiler (les flèches aussi), rien ne se charge avant LOAD. Les cinq touches sous l'écran font ce qui est écrit juste au-dessus d'elles : VOICE LOAD, FLTR SAVE (la première fois ton nom de 4 lettres et celui du preset, jusqu'à 10 ; sur un preset à toi chargé, OVERWRITE ou AS NEW), ENV NAME, FX DEL (puis YES), EDIT EXIT. Pour nommer, tape au clavier, ou le potard A choisit la lettre et B déplace le curseur. Une étoile : le preset chargé a bougé. L'écran ne se touche pas.",
    phone: {
      text: "Les presets du MM-RYTM : une liste, tes presets (MIKA/DEEP KICK) puis ceux d'usine. La moitié gauche ou droite du haut de l'écran passe au précédent ou au suivant, rien ne se charge avant LOAD. En bas : LOAD, SAVE (la première fois ton nom de 4 lettres et celui du preset, jusqu'à 10 ; sur un preset à toi chargé, OVERWRITE ou AS NEW), NAME, DEL (puis YES) et EXIT. Une étoile : le preset chargé a bougé.",
    },
  },
  seek: {
    section: 'SCREEN',
    title: 'TRACK',
    text: "La piste SoundCloud en cours, dans le pied de l'écran : touche la barre à l'endroit où tu veux reprendre la piste.",
  },
  ikey: {
    section: 'SCREEN',
    title: 'INFOS',
    text: "Allume l'aide : survole n'importe quelle commande du MM-RYTM (au doigt, touche-la : sa carte s'affiche, la commande n'agit pas) pour lire ce qu'elle fait ; un potard montre le réglage qu'il tient sur la page, pour la voix choisie. I au clavier l'allume et l'éteint (l'écran ne se touche pas : son i dit seulement que c'est allumé, il se remplit), la croix de la pastille INFOS ou Échap l'éteignent. Au téléphone, le i du Dock fait de même.",
    phone: {
      text: "Allume l'aide : touche n'importe quelle commande du MM-RYTM, sa carte s'affiche et la commande n'agit pas ; un glisser règle toujours une valeur de l'écran. Un bloc de l'écran montre le réglage qu'il tient, pour la voix choisie. Le i se remplit tant que c'est allumé ; touche-le encore ou la croix de la pastille INFOS pour l'éteindre. Le i du Dock fait de même.",
    },
  },
  home: {
    section: 'SCREEN',
    title: 'HOME',
    text: "L'écran de départ : en haut, le pattern, MASTER et TEMPO (sur la page MASTER, FX pressée trois fois) ; l'anneau des pas de la voix et ses cartes (VOLUME, TONE, DECAY) ; en bas, son menu, celui des touches : VOICE, FLTR, ENV et FX ouvrent leur page en vue PAGE, SOUND est le potard A de VOICE (une tape ouvre la liste des sons, une voix choisie d'abord). La touche allumée d'une page sans onglet (ou H) y revient, une touche de page ramène la vue PAGE ; sa LED reste à peine allumée.",
    phone: {
      text: "L'écran de départ : en haut, le pattern, MASTER et TEMPO (à glisser, comme dans la vue PAGE) ; l'anneau des pas de la voix et ses cartes (VOLUME, TONE, DECAY) ; en bas, son menu : SOUND ouvre la liste des sons de la voix (une voix choisie d'abord), VOICE, FLTR, ENV et FX ouvrent leur page et ses valeurs à glisser. La touche allumée d'une page sans onglet y revient ; sa LED reste à peine allumée.",
    },
  },
  enc: {
    section: 'SCREEN',
    title: 'EMPTY',
    text: "Une case vide de cet écran : rien à régler ici pour cette voix. Les blocs se règlent en les glissant de haut en bas, ou à la molette ; deux clics les remettent à leur départ (en P-LOCK, le verrou s'en va). Au MIDI, rytm:knob:1 à 8 sont les blocs A à H de l'écran affiché.",
  },
};

/** Les mots de la voix choisie : la voix d'abord, puis sa famille, puis sans voix. */
function wordsFor(r: Raw, voice: Inst | null | undefined): Words {
  if (!r.voice) return {};
  if (!voice) return r.voice.none ?? {};
  return { ...(r.voice[voiceGroup(voice)] ?? {}), ...(r.voice[voice] ?? {}) };
}

/** La section d'un reglage : la plaque, sinon l'ecran et la lettre de son bloc pour cette voix (ENV C), sinon celle de la table. */
function sectionOf(id: RytmInfoId, r: Raw, c: RytmInfoCtx): string {
  if (c.plate && r.plate) return r.plate.section;
  if (r.section === 'VOICES' || r.section === 'TRANSPORT' || r.section === 'SCREEN' || r.section === 'KEYS' || r.section === 'PAGES') return r.section;
  // Un encodeur du desktop (2026-10-09) : son FX global, a poste fixe
  if (c.encoder !== undefined) return `GLOBAL FX  ENCODER ${c.encoder + 1}`;
  const at = rytmSlotOf(id, c.voice ?? null, c.page);
  if (at) return `${RYTM_INFO_PAGE_LABEL[at.page]} ${RYTM_LETTERS[at.k]}`;
  return r.section;
}

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/**
 * La carte d'une commande du MM-RYTM, null pour un id inconnu. Un bloc de
 * l'ecran (p:0 a p:7) montre le reglage qu'il tient (ctx.page, ctx.voice,
 * ctx.target) ; une case vide, la carte des cases vides (enc).
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
    else if (rid === 'lock') title = `P-LOCK ${two(ctx.step + 1)}`;
  }
  // La phrase du verrou : pour un reglage des ecrans (la plaque TWEAKS n'a pas de pas) ; un FX global, son encodeur (au
  // telephone aussi depuis le 2026-10-19)
  const ph = PHONE ? r.phone : undefined;
  const base = w.text ?? ph?.text ?? r.text;
  const withLock = lock && !ctx.plate ? `${base} ${LOCK_LINE[lock]}` : base;
  // Au desktop (2026-10-27) : tout reglage des ecrans a son potard a sa place ; au telephone, les FX globaux leur encodeur
  const extra = PHONE ? (lock === 'global' && !ctx.plate && ENC_IDS.has(rid) ? ENC_LINE : '') : lock && !ctx.plate ? FACE_LINE : '';
  const text = phoneWords(extra ? `${withLock} ${extra}` : withLock);
  const tip = w.tip ?? r.tip;
  return {
    id: rid,
    section: sectionOf(rid, r, ctx),
    title,
    ...(r.steps ? { steps: (ph?.steps ?? r.steps).map((x) => fr(phoneWords(x))) } : {}),
    text: fr(text),
    ...(r.key ? { key: fr(`Au clavier : ${r.key}.`) } : {}),
    ...(tip ? { tip: fr(phoneWords(tip)) } : {}),
    avail: rytmAvail(rid),
    ...(lock ? { lock } : {}),
  };
}

/** Toutes les cartes (les tests, une page d'aide) : id, sans voix ni page. */
export function allRytmInfos(ctx: RytmInfoCtx = {}): RytmInfo[] {
  return (Object.keys(RAW) as RytmInfoId[]).map((id) => infoOf(id, ctx)).filter((x): x is RytmInfo => x !== null);
}
