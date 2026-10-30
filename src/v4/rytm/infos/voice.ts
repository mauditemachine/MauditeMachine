/** Les cartes INFOS du MM-RYTM : VOICE (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';
import { PHONE, PICK } from './words';

export const RAW_VOICE = {
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
} satisfies Partial<Record<RytmInfoId, Raw>>;
