/**
 * Les cartes INFOS reservees a V.6.0 (lane B5). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.5) : la lane y ajoute
 * ses cartes (un id de rytm/diagrams.ts chacune) ; l'ordre des fichiers est fige dans rytm/infos/index.ts.
 *
 * V.6.0 (2026-11-01, la face DT2, ?face=dt2) : une carte par touche, potard, page et menu nouveaux (rytm/infoIds.ts
 * RYTM_V60_IDS), en francais, au tutoiement.
 */

import type { RytmInfoId } from '../diagrams';
import type { Raw } from './types';

export const RAW_V60 = {
  /* ---------- les touches et les potards nouveaux de la face ---------- */
  'key:preset': {
    section: 'KEYS',
    title: 'PRESET/KIT',
    steps: ['PRESET/KIT : le menu.', 'KIT puis YES : la liste de tes presets ; UP, DOWN, YES charge.', 'RIGHT : SAVE TO HERE, RENAME, DELETE.'],
    text: "Le menu PRESET/KIT, comme sur une Digitakt. KIT : la liste de tes presets (toute la machine, ses sons et son motif) ; UP et DOWN la parcourent (ou LEVEL/DATA), YES charge, RIGHT ouvre les opérations (SAVE TO HERE, RENAME, DELETE), NO revient. RANDOM BEAT : un beat entier au hasard, le RANDOM d'avant. PRESET (le son d'une seule piste, sa banque, ses tags) arrive en V.6.2, comme FUNC + PRESET/KIT (PERFORM).",
    key: 'P',
    tip: 'RANDOM BEAT, puis PRESET/KIT > KIT > RIGHT > SAVE TO HERE : un beat trouvé au hasard est gardé.',
  },
  'key:settings': {
    section: 'KEYS',
    title: 'SETTINGS',
    text: "Le menu SETTINGS : PATTERN (RENAME, CLEAR, EDIT GRID), PERSONALIZE (LED INTENSITY, LED BACKLIGHT, REMEMBER SUBPAGE, TRK SELECT) et SYSTEM (ABOUT, STORAGE). UP et DOWN choisissent, YES ouvre ou change, NO revient d'un cran. PROJECT, SONG, MIDI CONFIG et AUDIO ROUTING sont là, à peine : ils arrivent avec les versions suivantes.",
    key: 'virgule',
  },
  'key:sounds': {
    section: 'KEYS',
    title: 'SOUNDS',
    steps: ['SOUNDS : la liste des sons de la piste.', 'UP, DOWN : un son ; YES le choisit (il s’entend).', 'FUNC + SOUNDS : tes fichiers.'],
    text: "L'ancienne touche SAMPLING de la Digitakt devient SOUNDS : la liste des sons de la piste active, sur tout l'écran (pistes 1 à 8 : ses machines 909, 808, MM, puis ses samples ; pistes 9 à 16 : la liste de son potard D SAMP, toute ta banque). UP et DOWN ou LEVEL/DATA descendent (avec FUNC, une page), YES choisit, LEFT et RIGHT prennent le son d'avant ou d'après, NO ferme. FUNC + SOUNDS : SAMPLES, tes fichiers ; IMPORT FILES pour en ajouter (ils vont dans la catégorie du son de la piste), YES deux fois sur un fichier pour le retirer.",
    key: 'U',
  },
  'key:tempo': {
    section: 'KEYS',
    title: 'TEMPO',
    text: "Le menu TEMPO, comme sur une Digitakt : le potard A règle le BPM, de 30 à 300 (LEVEL/DATA aussi ; UP et DOWN d'un BPM, avec FUNC de quatre), B FINE son dixième, D le SWING, de 50 à 80 %. FUNC + TEMPO : TAP, tape en rythme, le tempo suit après quatre tapes. Le métronome (E à H) arrive en V.6.1.",
    key: 'Y',
  },
  'key:kbd': {
    section: 'KEYS',
    title: 'KEYBOARD',
    text: "Le mode KEYBOARD de la Digitakt : les TRIG jouent la piste active en gamme, comme un clavier. La touche est dessinée à sa place ; elle arrive en V.6.1, avec FUNC + KEYBOARD (KB SETUP, les 36 gammes).",
    key: 'K',
  },
  'key:song': {
    section: 'KEYS',
    title: 'SONG',
    text: "SONG : les songs de la Digitakt, des lignes de patterns qui s'enchaînent (16 songs). La touche est dessinée à sa place ; elle arrive en V.6.2, avec FUNC + SONG (SONG EDIT).",
    key: 'N',
  },
  'key:arrows': {
    section: 'KEYS',
    title: 'FLÈCHES',
    text: "Dans un menu, UP et DOWN choisissent une ligne (avec FUNC, une page entière) ; LEFT et RIGHT changent de catégorie ou ouvrent un panneau (les opérations à droite). Sur une page, UP et DOWN passent à sa sous-page. PTN + LEFT ou RIGHT : la banque d'avant ou d'après ; un TRIG tenu + LEFT ou RIGHT : son micro timing.",
  },
  'key:page': {
    section: 'KEYS',
    title: 'PAGE',
    text: "PAGE et FILL, comme sur une Digitakt. Tiens PAGE pendant que ça joue : FILL dure tant que tu le tiens. YES puis PAGE : FILL pour un cycle. PAGE puis YES, en lâchant PAGE d'abord : FILL verrouillé, jusqu'à PAGE encore. Ses 8 LED montreront les pages du pattern quand il dépassera 16 pas (V.6.1).",
    key: 'G',
  },
  'key:mvol': {
    section: 'KEYS',
    title: 'MAIN VOLUME',
    text: "Le volume général de la machine, le MASTER d'avant : il a quitté l'écran pour sa place de Digitakt, en haut à gauche. Glisse-le (Maj : plus fin), tourne la molette dessus ; deux clics le remettent à son départ.",
  },
  'key:data': {
    section: 'KEYS',
    title: 'LEVEL/DATA',
    text: "Hors d'un menu : le niveau de la piste active (TRK LEV), que montre le fader de la colonne gauche de l'écran ; il ne se verrouille pas sur un pas, comme sur la Digitakt. Dans un menu : il fait défiler la liste ou règle la ligne choisie (le BPM dans TEMPO, le crossfader dans SCENES). FUNC + LEVEL/DATA (PRESET POOL) arrive en V.6.2.",
  },

  /* ---------- les menus de l'écran ---------- */
  'menu:machine': {
    section: 'SCREEN',
    title: 'MACHINE',
    steps: ['FUNC + SRC.', 'UP, DOWN : une machine.', 'YES : la piste active la prend.'],
    text: "La machine de la piste active. SRC : ONESHOT (le sample seul), KICK, SNARE, CL HAT, OP HAT, CLAP, LO TOM, HI TOM, CYMBAL (la synthèse 909, 808 ou MM, et sa couche sample : le son d'une voix d'avant). N'importe quelle machine sur n'importe laquelle des 16 pistes ; la page SRC change avec elle. LEFT et RIGHT : SRC ou FLTR (les filtres MULTI-MODE, LOWPASS 4 et EQ arrivent en V.6.1). NO ferme.",
  },
  'menu:tempo': {
    section: 'SCREEN',
    title: 'TEMPO',
    text: "La page TEMPO : A le BPM, de 30 à 300 ; B FINE, son dixième (45,7 BPM) ; D le SWING, de 50 à 80 %. LEVEL/DATA et UP, DOWN règlent aussi le BPM (avec FUNC, de quatre). METRO, SIG., PREROLL et VOL sont dessinés à peine : le métronome arrive en V.6.1. NO ferme.",
  },
  'menu:quantize': {
    section: 'SCREEN',
    title: 'QUANTIZE',
    text: "FUNC + TRIG : ramène les trigs décalés (leur micro timing) vers la grille, en direct. E TRACK : la piste active ; H PTN : toutes les pistes. 0 % ne change rien, 100 % les pose sur la grille ; tu peux revenir en arrière tant que le menu est ouvert, NO garde ce que tu entends. LEVEL/DATA règle TRACK.",
  },
  'menu:preset': {
    section: 'SCREEN',
    title: 'PRESET/KIT',
    text: "PRESET (V.6.2), KIT (la liste de tes presets : UP, DOWN, YES charge ; RIGHT : SAVE TO HERE, RENAME, DELETE ; une question se règle aux flèches et à YES ; le nom : UP et DOWN la lettre, LEFT et RIGHT le curseur, YES garde) et RANDOM BEAT. NO revient d'un cran.",
  },
  'menu:sounds': {
    section: 'SCREEN',
    title: 'SOUNDS',
    text: "La liste des sons de la piste active (pistes 9 à 16 : toute ta banque, comme son potard D SAMP) : NOW marque celui qu'elle joue. UP, DOWN ou LEVEL/DATA déplacent le curseur sans rien jouer ; YES choisit (+ LOAD A FILE : tes fichiers) ; LEFT et RIGHT, le son d'avant ou d'après ; NO ferme.",
  },
  'menu:samples': {
    section: 'SCREEN',
    title: 'SAMPLES',
    text: "FUNC + SOUNDS : tes fichiers, gardés dans ce navigateur. IMPORT FILES ouvre le choix des fichiers (WAV, MP3, AIFF ; 12 secondes au plus) ; ils vont dans la catégorie du son de la piste active. YES sur un de tes fichiers l'arme (REMOVE?), YES encore le retire ; NO le garde.",
  },
  'menu:settings': {
    section: 'SCREEN',
    title: 'SETTINGS',
    steps: ['PATTERN > RENAME : le nom du pattern.', 'PATTERN > CLEAR : efface, après une question.', 'PATTERN > EDIT GRID : la grille posée sur les pas.'],
    text: "PATTERN : RENAME (8 caractères, en tête de l'écran après A01), CLEAR (WHOLE PATTERN et SEQUENCE DATA effacent les pas, les verrous et les réglages de trig ; les sons sont encore communs à tous les patterns, donc CLEAR SOUNDS (ALL PATTERNS) demande deux confirmations), EDIT GRID (la grille d'avant, Maj + E). PERSONALIZE : LED INTENSITY, LED BACKLIGHT, REMEMBER SUBPAGE, TRK SELECT. SYSTEM : ABOUT (le firmware), STORAGE (la place prise dans ce navigateur).",
  },
  'menu:mixer': {
    section: 'SCREEN',
    title: 'MIXER',
    text: "FUNC + MOD : le niveau des 16 pistes (TRK LEV), sur trois pages : INTERNAL 1-8, INTERNAL 9-16, puis SCENES. UP et DOWN (ou FUNC + MOD encore) passent à la suivante ; A à H règlent les pistes de la page ; LEVEL/DATA, la piste active. Ce niveau est celui de LEVEL/DATA, avant le volume du son (AMP VOL).",
  },
  'menu:scenes': {
    section: 'SCREEN',
    title: 'SCENES',
    steps: ['FUNC + MOD, puis la page SCENES.', 'Presse le potard A (ou B) : la scène s’arme.', 'H ou LEVEL/DATA : le crossfader.'],
    text: "Les scènes A et B ont quitté la face pour cette page du MIXER, comme Mika l'a choisi. Presse le potard A ou B : sa scène s'arme (une tape d'avant, gardée jusqu'au geste suivant) ; tourne ensuite les potards d'une page, ils écrivent dans la scène. E et F disent combien de réglages a chaque scène ; H et LEVEL/DATA font le crossfader. LEFT et RIGHT arment aussi A et B. Le MIDI, le Roto et le boîtier gardent leurs scènes.",
  },

  /* ---------- la page SRC par machine ---------- */
  'src:page': {
    section: 'PAGES',
    title: 'SRC',
    text: "La page de la machine de la piste active, comme sur une Digitakt. Partout : A TUNE, B PLAY, D le sample, H LEV. ONESHOT : E STRT, F LEN, G LOOP (V.6.1), H le niveau du sample ; 2/2 : FINE. Une machine de synthèse : E, F, G ses trois premiers potards, H le niveau de sa synthèse ; 2/2 : le reste (ses autres potards, MODL 909, 808 ou MM, SMP le niveau de sa couche sample, FINE, STRT, LEN). SRC encore (ou UP, DOWN) : l'autre sous-page. FUNC + SRC : la machine.",
  },
  't:tune': {
    section: 'SRC',
    title: 'TUNE',
    text: "La hauteur de toute la piste, au demi-ton, de -24 à +24 : le sample et sa synthèse ensemble.",
    lock: 'yes',
  },
  't:srev': {
    section: 'SRC',
    title: 'PLAY',
    text: "Le sens de lecture du sample : FWD (en avant) ou REV (à l'envers). Les boucles (FWD LOOP, REV LOOP) arrivent en V.6.1.",
    lock: 'yes',
  },
  't:snd': {
    section: 'SRC',
    title: 'SAMP',
    text: "Le sample de la piste, pris dans toute ta banque (les 8 dossiers du site et tes fichiers), sur n'importe quelle piste ; OFF le coupe. Sur une machine de synthèse, c'est sa couche sample (SND). Un pas tenu : le sample lock, ce pas joue un autre sample.",
    lock: 'yes',
  },
  't:sstart': {
    section: 'SRC',
    title: 'STRT',
    text: "D'où part le sample : 0 au début ; plus haut, l'attaque est sautée.",
    lock: 'yes',
  },
  't:slen': {
    section: 'SRC',
    title: 'LEN',
    text: "La longueur du sample joué, depuis STRT ; 127 le joue en entier.",
    lock: 'yes',
  },
  't:slev': {
    section: 'SRC',
    title: 'LEV',
    text: "Le niveau du sample, avant le filtre et l'enveloppe (SMP sur la deuxième page d'une machine de synthèse : sa couche sample).",
    lock: 'yes',
  },
  't:syn': {
    section: 'SRC',
    title: 'LEV',
    text: "Le niveau de la synthèse de la machine (909, 808, MM) ; à 0, seul le sample joue.",
    lock: 'yes',
  },
  't:fine': {
    section: 'SRC',
    title: 'FINE',
    text: "La hauteur fine de la piste, au centième de demi-ton, pour accorder deux sons entre eux.",
    lock: 'yes',
  },
  't:model': {
    section: 'SRC',
    title: 'MODL',
    text: "Le modèle de la synthèse de la machine : 909, 808 ou MM. Un pas tenu : ce pas joue un autre modèle.",
    lock: 'yes',
  },
  trklev: {
    section: 'MIXER',
    title: 'TRK LEV',
    text: "Le niveau de la piste dans le mix, comme sur une Digitakt : LEVEL/DATA sur une page, A à H sur les pages INTERNAL du MIXER. 0 dB vers les quatre cinquièmes (102), il ne se verrouille pas sur un pas (AMP VOL, lui, se verrouille).",
    lock: 'no',
  },
} satisfies Partial<Record<RytmInfoId, Raw>>;
