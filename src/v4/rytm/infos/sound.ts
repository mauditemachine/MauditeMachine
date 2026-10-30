/** Les cartes INFOS du MM-RYTM : FLTR, ENV et VOICE FX (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';

export const RAW_SOUND = {
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
} satisfies Partial<Record<RytmInfoId, Raw>>;
