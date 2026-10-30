/** Les cartes INFOS du MM-RYTM : GLOBAL FX et les pages des FX globaux (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';
import { TAP_KNOB, NO_BD } from './words';

export const RAW_FX = {
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
} satisfies Partial<Record<RytmInfoId, Raw>>;
