/** Les cartes INFOS du MM-RYTM : les couches SYNTH et SAMPLE (R3) (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';

export const RAW_LAYERS = {
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
} satisfies Partial<Record<RytmInfoId, Raw>>;
