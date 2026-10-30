/** Les cartes INFOS du MM-RYTM : les touches de page et les onglets (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';
import { PHONE } from './words';

export const RAW_PAGES = {
  /* ---------- les touches de page et les onglets (2026-10-09) ---------- */
  voice: {
    section: 'PAGES',
    title: PHONE ? 'VOICE' : 'SRC',
    text: "La source de la voix choisie (l'ancienne page VOICE, la touche SRC) : SOUND en grand (OFF, 909, 808, MM, puis les samples de sa famille, une seule liste), VOL (son niveau ; en P-LOCK, celui du pas), PITCH et FINE (la hauteur de toute la voix) ; sur une voix qui a des samples (BD, SD et OH au départ, et toute voix où tu as déposé les tiens), LEN et REV règlent le sample, et SRC encore passe à l'onglet SYNTH (la machine sous le sample, MIX), puis revient ; sur les autres, elle montre HOME. FUNC + SRC : SOUNDS, la liste des sons de la voix. SRC puis YES (dans les 1,5 s) : la source au hasard (son, niveau, hauteur) ; SRC puis NO : rechargée du point de sauvegarde (FUNC + YES).",
    phone: { text: "Tout ce que joue la voix choisie, sur un seul écran (TRIG, SRC et SMPL réunis) : SOUND en grand (OFF, 909, 808, MM, puis les samples de sa famille, une seule liste), VOL en grand (son niveau ; en P-LOCK, celui du pas : vélocité et volume ne font qu'un), PITCH et FINE (la hauteur de toute la voix) ; sur une voix qui a des samples (BD, SD et OH au départ, et toute voix où tu as déposé les tiens), LEN et REV règlent le sample, et la touche VOICE allumée passe à l'onglet SYNTH (la machine sous le sample, MIX), puis revient ; sur les autres, elle montre HOME." },
    tip: 'Choisis le son (SOUND), puis son niveau (VOL) : la voix est posée. En P-LOCK, SOUND change le son d’un seul pas : un sample lock, comme sur l’Analog Rytm.',
  },
  synth: {
    section: 'PAGES',
    title: PHONE ? 'VOICE SYNTH' : 'SRC SYNTH',
    text: "L'onglet SYNTH de SRC (les voix qui ont des samples : BD, SD, OH...) : la couche de synthèse, comme une machine de l'Analog Rytm. MACHINE (909, 808 ou MM, le son calculé), MIX (la synthèse et le sample comme un crossfader, de -64 la synthèse seule à +63 le sample seul, 0 les deux à fond), puis ses réglages : TUNE, ATTACK, SWEEP, DECAY et DRIVE pour le kick ; TUNE, SNAPPY, TONE, DECAY et GATE pour la caisse claire ; sur les autres voix, MACHINE et MIX seuls (le clap garde GATE). Chaque réglage dit la couche qu'il touche : MACHINE, la synthèse seule ; BOTH, les deux. Les deux couches passent ensuite par la même voix (FLTR, AMP, FX). La touche SRC encore ramène l'onglet principal.",
    phone: { text: "L'onglet SYNTH de VOICE (les voix qui ont des samples : BD, SD, OH...) : la couche de synthèse, comme une machine de l'Analog Rytm. MACHINE (909, 808 ou MM, le son calculé), MIX (la synthèse et le sample comme un crossfader, de -64 la synthèse seule à +63 le sample seul, 0 les deux à fond), puis ses réglages : TUNE, ATTACK, SWEEP, DECAY et DRIVE pour le kick ; TUNE, SNAPPY, TONE, DECAY et GATE pour la caisse claire ; sur les autres voix, MACHINE et MIX seuls (le clap garde GATE). Chaque réglage dit la couche qu'il touche : MACHINE, la synthèse seule (au téléphone, l'onglet SYNTH le dit pour tous) ; BOTH, les deux. Les deux couches passent ensuite par la même voix (FLTR, ENV, FX). La touche VOICE encore, ou MAIN dans l'en-tête, ramène l'onglet principal." },
    tip: 'MIX vers 0 sur un kick de Mika : le grave d’un 909 accordé sous l’attaque du sample.',
  },
  fltr: {
    section: 'PAGES',
    title: 'FLTR',
    text: "Un vrai filtre par coup, comme sur une Elektron : FREQ (sa coupure, de 20 Hz à 20 kHz), RESO (sa bosse), TYPE (passe-bas, passe-haut ou passe-bande), et son enveloppe : ENV (de combien d'octaves elle ouvre ou ferme le filtre, ±5), ATK et DEC (sa montée, sa redescente). TONE, la bascule d'avant (un passe-bas à gauche, un passe-haut à droite), reste à côté. Le dessin FILTER montre la courbe ; en pointillé, la coupure au sommet de l'enveloppe. Tout se verrouille pas par pas. Au départ, le filtre est grand ouvert : rien n'est calculé. FLTR puis YES : le filtre au hasard ; FLTR puis NO : rechargé du point de sauvegarde. FUNC + FLTR : SETUP (la longueur des pistes, en V.5.2).",
    phone: { text: "Un vrai filtre par coup, comme sur une Elektron : FREQ (sa coupure, de 20 Hz à 20 kHz), RESO (sa bosse), TYPE (passe-bas, passe-haut ou passe-bande), et son enveloppe : ENV (de combien d'octaves elle ouvre ou ferme le filtre, ±5), ATK et DEC (sa montée, sa redescente). TONE, la bascule d'avant (un passe-bas à gauche, un passe-haut à droite), reste à côté. Le dessin FILTER montre la courbe ; en pointillé, la coupure au sommet de l'enveloppe. Tout se verrouille pas par pas. Au départ, le filtre est grand ouvert : rien n'est calculé." },
    tip: 'Un passe-bas vers 2 kHz, RESO à 60 et ENV à +2 : la caisse claire claque puis s’assombrit, la dark disco.',
  },
  env: {
    section: 'PAGES',
    title: PHONE ? 'ENV' : 'AMP',
    text: "L'enveloppe du coup (l'ancienne page ENV, la touche AMP) : ATK (une montée douce au lieu de la frappe, de SNAP à 500 ms), HOLD (combien de temps il reste plein, de 4 ms à 1 s), DEC (sa queue ; tout en haut, le son entier), et le dessin AMP ENV qui les montre sur la grille des doubles croches. START (où commence le coup) et PAN (sa place) sont là aussi. Tout se verrouille pas par pas ; VOL est dans SRC. AMP puis YES : l'enveloppe au hasard ; AMP puis NO : rechargée du point de sauvegarde. FUNC + AMP : EUCLID (en V.5.3).",
    phone: { text: "L'enveloppe du coup (l'ancien AMP, complet) : ATK (une montée douce au lieu de la frappe, de SNAP à 500 ms), HOLD (combien de temps il reste plein, de 4 ms à 1 s), DEC (sa queue ; tout en haut, le son entier), et le dessin AMP ENV qui les montre sur la grille des doubles croches. START (où commence le coup) et PAN (sa place) sont là aussi. Tout se verrouille pas par pas ; VOL est passé dans VOICE." },
    tip: 'La page des ghost notes : en P-LOCK, un ATK de 20 ms et un DEC court sur quelques pas de caisse claire.',
  },
  fx: {
    section: 'PAGES',
    title: 'FX',
    text: "Les effets de la voix choisie (VOICE FX) : DIST, CHORUS, DELAY et REVERB, en quatre grands blocs, son nom en étiquette, tous verrouillables pas par pas. Une tape sur le potard de l'un d'eux ouvre sa page sur la voix (son envoi en grand, les réglages de la machine à côté) ; FX ou NO y revient. FUNC + FX : SEND FX, les huit effets de tout le MM-RYTM (l'ancien GLOBAL FX : DIST, CHORUS, DELAY, REVERB, STRETCH, SWING, BIT, COMP), jamais verrouillés. FX puis YES : les effets de la voix au hasard ; FX puis NO : rechargés du point de sauvegarde. Les huit potards à droite de l'écran tournent les blocs de la page montrée, à la même place (A en haut à gauche).",
    phone: { text: `Deux onglets. VOICE FX : les effets de la voix choisie (DIST, CHORUS, DELAY, REVERB, en quatre grands blocs, son nom en étiquette, au téléphone dans l'onglet de l'en-tête), tous verrouillables pas par pas. GLOBAL FX (la touche FX encore, ou GLOBAL dans l'en-tête) : les huit effets de tout le MM-RYTM, DIST (kick compris), CHORUS, DELAY et REVERB (sauf le kick, il a sa propre voie), STRETCH, SWING, BIT et COMP ; ceux-là ne se verrouillent jamais. Une tape sur DIST, CHORUS, DELAY, REVERB, BIT ou COMP ouvre sa page, avec ses réglages ; sur celles de DIST, CHORUS, DELAY et REVERB, deux onglets en haut : GLOBAL (la quantité de la machine) et la voix (BD : son envoi à elle, verrouillable), les réglages à côté restent ceux de la machine. Une tape sur un FX de VOICE FX ouvre sa page sur la voix ; la touche FX ramène GLOBAL FX, ou VOICE FX depuis la voix. ${PHONE ? 'Au desktop, ce sont aussi les huit encodeurs, dans le même ordre : en tourner un ouvre sa page.' : "Les huit potards à droite de l'écran tournent les blocs de la page montrée, à la même place (A en haut à gauche) ; un potard n'ouvre jamais de page."}` },
    tip: 'En dark disco, un DELAY sur la seule caisse claire (VOICE FX, SD) : l’écho reste derrière le kick.',
  },
  fxv: {
    section: 'PAGES',
    title: 'VOICE FX',
    text: "Les effets de la voix choisie, son nom en étiquette : DIST (la saturation parallèle), CHORUS (l'élargissement), DELAY et REVERB (leurs envois). Tous se verrouillent pas par pas : un pas garde sa DIST, l'effet tient jusqu'au coup suivant de la voix, comme sur une Elektron. Pour le kick, ce sont ses seuls effets : SEND FX ne le touche pas. Une tape sur le potard de l'un d'eux ouvre sa page sur la voix : son envoi en grand, les réglages de la machine à côté (DELAY : TIME, FEEDBACK, TONE) ; FX ou NO revient ici. FUNC + FX : SEND FX, la quantité de la machine.",
    phone: { text: "Les effets de la voix choisie, son nom en étiquette (au téléphone, l'onglet BD FX de l'en-tête le dit) : DIST (la saturation parallèle), CHORUS (l'élargissement), DELAY et REVERB (leurs envois). Tous se verrouillent pas par pas : un pas garde sa DIST, l'effet tient jusqu'au coup suivant de la voix, comme sur une Elektron. Pour le kick, ce sont ses seuls effets : les FX globaux ne le touchent pas. Une tape sur l'un d'eux ouvre sa page sur la voix : son envoi en grand, les réglages de la machine à côté (DELAY : TIME, FEEDBACK, TONE), GLOBAL en haut pour passer à la quantité de la machine ; la touche FX revient ici (sous GLOBAL, à GLOBAL FX)." },
    tip: 'Une REVERB verrouillée sur le dernier clap de la mesure seulement : l’espace s’ouvre une fois, puis se referme.',
  },
  fxg: {
    section: 'PAGES',
    title: PHONE ? 'GLOBAL FX' : 'SEND FX',
    text: "Les huit effets de tout le MM-RYTM (FUNC + FX : SEND FX, l'ancien GLOBAL FX), chacun à la place d'un des huit potards à droite de l'écran (deux rangées de quatre) : DIST (tout, kick compris), CHORUS, DELAY et REVERB (le bus des voix sauf le kick : NO BD), STRETCH (la longueur de tous les coups), SWING, BIT (la réduction de bits) et COMP (le compresseur). Une tape sur le potard de DIST, CHORUS, DELAY, REVERB, BIT ou COMP ouvre sa page, sa quantité en grand et ses réglages à côté (DELAY : TIME, FEEDBACK, TONE ; REVERB : SIZE, TONE, PRE ; COMP : THRESH, RATIO, ATTACK, RELEASE...) ; NO ramène SEND FX ; deux clics remettent toujours un bloc à son départ. Jamais verrouillés sur un pas : en P-LOCK, leurs blocs disent GLOBAL à la place de leur unité. FUNC + FX puis YES : les effets de la machine au hasard.",
    phone: {
      text: "Les huit effets de tout le MM-RYTM, dans l'ordre des huit encodeurs sous l'écran (deux rangées de quatre) : DIST (tout, kick compris), CHORUS, DELAY et REVERB (le bus des voix sauf le kick : NO BD), STRETCH (la longueur de tous les coups), SWING, BIT (la réduction de bits) et COMP (le compresseur). Touche DIST, CHORUS, DELAY, REVERB, BIT ou COMP (ou glisse son encodeur) : sa page s'ouvre, sa quantité en grand et ses réglages à côté (DELAY : TIME, FEEDBACK, TONE ; REVERB : SIZE, TONE, PRE ; COMP : THRESH, RATIO, ATTACK, RELEASE...). Sur les pages de DIST, CHORUS, DELAY et REVERB, l'onglet de la voix en haut (BD) passe à son envoi à elle, GLOBAL revient à la machine ; la touche FX ramène GLOBAL FX (sur BIT et COMP, GLOBAL dans l'en-tête aussi) ; deux tapes remettent toujours un bloc à son départ. Jamais verrouillés sur un pas : en P-LOCK, leurs blocs disent GLOBAL à la place de leur unité.",
    },
    tip: 'Sur la page DELAY, TIME sur 1/8D et FEEDBACK vers 70 % : le rebond de l’indie dance ; un peu de DELAY global suffit.',
  },
} satisfies Partial<Record<RytmInfoId, Raw>>;
