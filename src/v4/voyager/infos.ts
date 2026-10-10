/**
 * Le contenu des INFOS du MM-ARP (2026-10-08, Mika : "excellent pour le
 * bouton INFO ! je veux un petit bouton i dans l'ecran a activer et de ce
 * fait on peut voir les infos au survol"). Une carte par commande, en
 * francais (tutoiement, typo quebecoise comme bass/infos.ts : espace
 * insecable avant le deux-points et entre un nombre et son unite,
 * apostrophe typographique ; jamais de tiret cadratin) : sa section du
 * panneau, son nom tel qu'il est serigraphie, deux a quatre phrases sur ce
 * que la commande fait DANS ce synthe (les lois de params.ts, du worklet
 * audio/moog.worklet.js et d'audio/synth.ts), une astuce pour la dark
 * disco et l'indie dance. Les dessins : voyager/diagrams.ts ; la carte :
 * voyager/InfosCard.tsx.
 * Les ids : chaque potard (VoyKnobId, face et TWEAKS), les pads (pad),
 * les touches (run, clear, random, edit, open), l'ecran et ses presets,
 * l'ecran de la suite (seq), la touche i (infos).
 */

import type { VoyInfoId } from './diagrams';
import { VOY_INFO_SECTION } from './infoIds';

export interface VoyInfo {
  /** la section du panneau (OSCILLATORS, FILTER...), en petites capitales sur la carte */
  section: string;
  /** le nom serigraphie */
  title: string;
  text: string;
  tip?: string;
}

/** Les espaces insecables du francais (Quebec) et l'apostrophe typographique. */
const fr = (s: string): string =>
  s
    .replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, '$1’$2')
    .replace(/ :/g, ' :')
    .replace(/(\d) (ms|s|Hz|kHz|dB|%|cents|octaves?|demi-tons?|pas|mesures?|temps|BPM)(?![A-Za-zÀ-ÿ])/g, '$1 $2');

const RAW: Record<VoyInfoId, Omit<VoyInfo, 'section'>> = {
  /* ---------- ARPEGGIATOR (le plateau) ---------- */
  rate: {
    title: 'RATE',
    text: "La vitesse de l'arpège, calée sur le tempo : 1/4 (une note par temps), 1/8, 1/16 ou 1/32 (deux notes par double croche). Quand le MM-RYTM joue, chaque note tombe sur sa grille, swing compris.",
    tip: "1/16 pour l'indie dance qui roule, 1/8 pour une dark disco plus posée ; passe en 1/32 sur la dernière mesure avant un drop.",
  },
  mode: {
    title: 'MODE',
    text: "L'ordre des notes de l'accord : UP (de la plus grave à la plus aiguë), DOWN, UP/DN (aller-retour sans répéter les bouts) ou RAND (une note tirée à chaque pas, jamais deux fois la même de suite). Tourner MODE, RANGE ou NOTES rend la suite des potards ; tes notes d'EDIT restent en mémoire.",
    tip: "UP/DN sur 2 octaves donne la vague typique de l'italo ; RAND avec NOTES à 4 garde un motif qui surprend sans partir dans tous les sens.",
  },
  range: {
    title: 'RANGE',
    text: "Sur combien d'octaves l'arpège monte : 1, 2 ou 3. Les notes de l'accord (selon CHORD, sous le capot) se répètent une octave plus haut à chaque cran : le motif s'allonge.",
    tip: "1 OCT pour une ligne serrée sous la voix, 3 OCT pour une montée qui ouvre la piste.",
  },
  notes: {
    title: 'NOTES',
    text: "La longueur du motif. ALL : toutes les notes de RANGE, dans l'ordre du MODE. De 1 à 8 : seulement les N premières, puis le motif reprend. Un motif de 3 ou 5 notes sur des doubles croches tourne contre la mesure.",
    tip: "NOTES à 3 en 1/16 : la polyrythmie qui fait avancer une dark disco sans changer d'accord.",
  },
  gate: {
    title: 'GATE',
    text: "La durée de chaque note, de 8 % (piqué) à 100 % (lié) de l'intervalle entre deux notes. L'enveloppe AMP EG joue dans cette durée : un RELEASE long prolonge encore la note.",
    tip: "Vers 35 % avec un DECAY court pour un pluck nerveux ; 90 % et un peu de GLIDE pour une basse qui coule.",
  },
  octave: {
    title: 'OCTAVE',
    text: "Décale tout l'arpège de -2 à +2 octaves. À 0, les racines des accords sont posées autour de fa dièse 3.",
    tip: "-1 transforme l'arpège en ligne de basse ; +1 pour une lead qui passe au-dessus du mix.",
  },
  glide: {
    title: 'GLIDE',
    text: "Le glissement d'une note à la suivante, en hauteur logarithmique comme un Moog : rien à gauche, jusqu'à 0,6 s à droite. Il s'entend dès le premier quart.",
    tip: "Une touche de GLIDE (10 à 20 %) avec GATE long : l'arpège devient une ligne acide.",
  },

  /* ---------- OSCILLATORS (le panneau) ---------- */
  wave1: {
    title: 'WAVEFORM 1',
    text: "La forme d'OSC 1, en morphing continu : SINE, TRI, SAW, SQUARE, PULSE (14 %), puis FM (sa sinusoïde dont OSC 2 décale la phase). Entre deux crans, les deux formes se mélangent, sans creux ni saut de niveau.",
    tip: "Entre SAW et SQUARE pour une dark disco grasse ; MOD sur WAVE fait respirer le timbre sur une mesure.",
  },
  range1: {
    title: 'RANGE 1',
    text: "Le registre d'OSC 1 en pieds d'orgue, comme le Minimoog : LO (trois octaves dessous), 32', 16', 8' (la note jouée), 4' et 2'.",
    tip: "OSC 1 en 8' et OSC 2 en 16' : le son de départ, plein sans être boueux.",
  },
  semi1: {
    title: 'SEMI 1',
    text: "Décale OSC 1 de -7 à +7 demi-tons. À +7 (la quinte), les deux oscillateurs forment un accord à eux seuls.",
    tip: "Quinte (+7) sur OSC 2 plutôt que sur OSC 1 : la note jouée reste la plus forte.",
  },
  fine1: {
    title: 'FINE 1',
    text: "L'accord fin d'OSC 1, de -50 à +50 cents. Désaccordé contre OSC 2, il bat : plus l'écart grandit, plus le battement accélère. Au départ, -8 et +8 cents : le centre reste juste.",
    tip: "±8 à ±12 cents pour l'épaisseur d'un vieux Moog ; au-delà de 25, ça sonne faux, à garder pour un effet.",
  },
  on1: {
    title: 'ON 1',
    text: "Allume ou coupe OSC 1 sans toucher à son volume (OSC 1 du MIXER) ; la LED rouge le dit. Le passage est lissé : jamais de clic.",
    tip: "Coupe un oscillateur pour entendre l'autre seul pendant que tu règles sa forme.",
  },
  wave2: {
    title: 'WAVEFORM 2',
    text: "La forme d'OSC 2, en morphing continu : SINE, TRI, SAW, SQUARE, PULSE. C'est aussi lui qui module OSC 1 quand WAVEFORM 1 est sur FM, et lui qui crie avec SYNC (sous le capot).",
    tip: "Un SQUARE une octave sous OSC 1 donne du corps sans voler les médiums.",
  },
  range2: {
    title: 'RANGE 2',
    text: "Le registre d'OSC 2 en pieds d'orgue : LO, 32', 16', 8', 4', 2'. Au départ en 16', une octave sous OSC 1.",
    tip: "Avec SYNC allumé, monte RANGE 2 : le timbre se déchire au lieu de changer de note.",
  },
  semi2: {
    title: 'SEMI 2',
    text: "Décale OSC 2 de -7 à +7 demi-tons, par rapport à son RANGE.",
    tip: "+5 (la quarte) ou +7 (la quinte) pour un son de lead à la Moog.",
  },
  fine2: {
    title: 'FINE 2',
    text: "L'accord fin d'OSC 2, de -50 à +50 cents, contre OSC 1 : le battement qui épaissit le son.",
    tip: "Garde FINE 1 et FINE 2 de part et d'autre de 0 : le son grossit sans sortir de la tonalité.",
  },
  on2: {
    title: 'ON 2',
    text: "Allume ou coupe OSC 2 sans toucher à son volume ; sa LED rouge le dit.",
    tip: "OSC 2 coupé et WAVEFORM 1 en SINE : une basse pure pour les drops.",
  },
  osc1: {
    title: 'OSC 1',
    text: "Le volume d'OSC 1 dans le filtre (au carré du potard, 0,88 au maximum). Les deux à 84 % : le mélange de départ, à mi-chemin.",
    tip: "Baisse un peu OSC 2 quand il est une octave dessous, la basse reste nette.",
  },
  osc2: {
    title: 'OSC 2',
    text: "Le volume d'OSC 2 dans le filtre (au carré du potard). Plus il monte, plus il pousse la saturation des étages du filtre.",
    tip: "Les deux au maximum avec un peu d'OVERDRIVE : la crasse analogique de la dark disco.",
  },
  sub: {
    title: 'SUB',
    text: "Le volume du SUB dans le filtre (au carré du potard) : un troisième oscillateur sous la note jouée, une ou deux octaves plus bas (SUB OCT), en sinus, triangle ou carré (SUB WAVE). Il prend le FINE d'OSC 1 et ne bat pas contre lui. À 0, il est coupé.",
    tip: "SUB vers 50 % en SINE à -1 : l'arpège gagne du poids sans salir le bas ; avec BASS MONO (TWEAKS), il reste au centre.",
  },
  subOct: {
    title: 'SUB OCT',
    text: "L'octave du SUB : -1, une octave sous la note jouée, ou -2, deux octaves sous elle. Il suit la note, pas RANGE ni SEMI d'OSC 1.",
    tip: "-2 en SINE sur un arpège aigu : un grave profond façon 808 sous chaque note.",
  },
  subWave: {
    title: 'SUB WAVE',
    text: "La forme du SUB : SINE (un grave pur), TRI (un peu plus présent) ou SQUARE (creux et gras, il passe mieux sur de petites enceintes).",
    tip: "SQUARE à -1 avec la coupure basse : le grondement d'une basse Moog sous l'arpège.",
  },
  noise: {
    title: 'NOISE',
    text: "Un bruit blanc par voix, envoyé dans le filtre avec les oscillateurs (son niveau au carré du potard). Il suit les enveloppes : un souffle sur l'attaque, ou un tapis continu.",
    tip: "10 à 20 % avec RES haute : l'attaque prend du grain sans devenir une caisse claire.",
  },
  fm: {
    title: 'FM',
    text: "Un opérateur sinus module la phase d'OSC 1, quelle que soit sa forme : l'indice monte au carré du potard, jusqu'à 6, et suit l'enveloppe du filtre (l'attaque brille, la tenue s'adoucit). RATIO choisit sa fréquence.",
    tip: "FM vers 30 % avec RATIO à 2 : des cloches métalliques qui collent à la techno mélodique.",
  },
  ratio: {
    title: 'RATIO',
    text: "La fréquence de l'opérateur FM en multiple d'OSC 1 : 1/2, 1, 3/2, 2, 3, 7/2, 4, 5, 7. Des rapports harmoniques : le son reste dans la tonalité.",
    tip: "1 ou 2 pour du corps, 7/2 et 7 pour des timbres de cloche.",
  },

  /* ---------- FILTER ---------- */
  cutoff: {
    title: 'CUTOFF',
    text: "La fréquence de coupure du filtre en échelle (24 dB par octave en MOOG), de 30 Hz à 19 kHz : à gauche sombre, à droite ouvert. Elle suit la note (KEY TRACK, sous le capot) et l'enveloppe FILTER EG (ENV AMT).",
    tip: "Le geste principal : pars fermé vers 300 Hz et ouvre sur 8 ou 16 mesures, l'arpège sort du mix tout seul.",
  },
  res: {
    title: 'RES',
    text: "La résonance : la rétroaction des quatre étages fait une bosse autour de la coupure. Haute, le filtre siffle sur chaque note de l'arpège ; les graves restent gardés en passe-bas.",
    tip: "60 à 75 % avec un DECAY court du FILTER EG : le pluck qui claque des années 80.",
  },
  envAmt: {
    title: 'ENV AMT',
    text: "De combien l'enveloppe FILTER EG ouvre la coupure : de 0 à 6 octaves au-dessus de CUTOFF, à chaque note (un peu plus sur les accents).",
    tip: "Coupure basse et ENV AMT haut : chaque note s'ouvre et se referme, l'arpège parle.",
  },
  fmode: {
    title: 'MODE',
    text: "Le type de filtre : MOOG (passe-bas 24 dB, celui d'origine), 12 (passe-bas 12 dB, plus ouvert), BP (passe-bande) ou HP (passe-haut). Une tape passe au suivant ; le changement est fondu, sans clic.",
    tip: "BP avec la résonance pour un arpège fin qui laisse la place à la basse ; HP pour une montée.",
  },

  /* ---------- FILTER EG / AMP EG ---------- */
  fA: { title: 'ATTACK', text: "Le temps que met l'enveloppe du filtre pour monter, de 1 ms à 2 s (exponentiel).", tip: "Une attaque lente sur un arpège rapide : le filtre n'a pas le temps de s'ouvrir, effet de vague." },
  fD: { title: 'DECAY', text: "Le temps de redescente de l'enveloppe du filtre vers SUSTAIN, de 5 ms à 2 s.", tip: "Court (10 à 25 %) pour un pluck, long pour une note qui s'éteint en se refermant." },
  fS: { title: 'SUSTAIN', text: "Le niveau où l'enveloppe du filtre se tient tant que la note dure (GATE).", tip: "À 0 avec un DECAY court : le filtre ne s'ouvre qu'au début de chaque note." },
  fR: { title: 'RELEASE', text: "Le temps de retombée de l'enveloppe du filtre après la fin de la note, de 5 ms à 3 s.", tip: "Garde-le proche du RELEASE de l'AMP EG pour que la queue reste brillante." },
  aA: { title: 'ATTACK', text: "Le temps de montée du volume de chaque note, de 1 ms à 2 s. À 0, l'attaque claque.", tip: "Un peu d'attaque (10 %) adoucit l'arpège derrière une voix." },
  aD: { title: 'DECAY', text: "Le temps de descente du volume vers SUSTAIN, de 5 ms à 2 s.", tip: "DECAY court et SUSTAIN bas : chaque note devient une percussion mélodique." },
  aS: { title: 'SUSTAIN', text: "Le volume tenu tant que la note dure (GATE).", tip: "Au maximum pour une nappe arpégée qui ne respire que par le filtre." },
  aR: { title: 'RELEASE', text: "Le temps que la note met à s'éteindre après sa fin, de 5 ms à 3 s ; les queues de plusieurs notes se chevauchent (jusqu'à 12 voix).", tip: "Un RELEASE long sur 1/16 crée un tapis d'accords sans toucher aux pads." },

  /* ---------- MOD ---------- */
  lfoRate: { title: 'SPEED', text: "La durée d'un cycle du LFO, calée sur le tempo : de 1/16 à 4 mesures. Il repart de zéro à la première note après un STOP.", tip: "1 BAR sur la coupure : le mouvement classique qui suit la mesure." },
  lfoShape: { title: 'SHAPE', text: "La forme du LFO : TRI (triangle), SAW (dent de scie), SQR (carré) ou S&H (une valeur tirée au hasard par cycle, tenue).", tip: "S&H en 1/16 sur CUTOFF : le gargouillis aléatoire des vieux arpégiateurs." },
  lfoDest: { title: 'TARGET', text: "Ce que le LFO pousse : WAVE (les deux formes d'onde, jusqu'à 2 crans), CUTOFF (jusqu'à 3 octaves), FM, PITCH (un demi-ton) ou W+CUT (formes et coupure à moitié chacune).", tip: "W+CUT en 2 BAR : le son change de couleur sans que personne ne sache pourquoi." },
  lfoAmt: { title: 'DEPTH', text: "La profondeur du LFO sur sa cible. À 0, MOD ne fait rien.", tip: "Commence bas (15 %) : sur la coupure, un peu suffit." },

  /* ---------- EFFECTS / OUTPUT ---------- */
  dist: { title: 'OVERDRIVE', text: "Un overdrive doux et asymétrique dans le filtre et à sa sortie : il ajoute des harmoniques et tasse les crêtes, le volume est rattrapé.", tip: "20 à 35 % pour la chaleur d'une console ; au-delà pour un arpège qui grogne." },
  chorus: { title: 'CHORUS', text: "Un chorus façon Juno-106 : deux copies légèrement retardées dont le retard ondule, à gauche et à droite. Il élargit le son ; BASS MONO (sous le capot) garde les graves au centre.", tip: "40 % : la largeur de départ ; coupe-le pour un arpège sec et frontal." },
  delay: { title: 'DELAY', text: "Un délai ping-pong en croche pointée calé sur le tempo (gauche, droite, gauche...) ; le potard monte l'envoi et la réinjection (0,35 à 0,68), filtrée dans la boucle.", tip: "La croche pointée contre des doubles croches : l'arpège se dédouble en contre-chant, signature de l'indie dance." },
  reverb: { title: 'REVERB', text: "L'envoi vers la réverbe partagée avec le MM-RYTM. Le volume est rattrapé quand elle monte.", tip: "Peu de réverbe sur un arpège rapide : il reste net ; plus sur 1/8 lent." },
  volume: { title: 'VOLUME', text: "Le volume du MM-ARP (au carré du potard), réglé 3 à 5 dB sous le kick du MM-RYTM au départ.", tip: "Le kick reste la référence : règle l'arpège à l'oreille contre lui, pas seul." },

  /* ---------- TWEAKS (sous le capot, OPEN) ---------- */
  phase: { title: 'PHASE', text: "FREE : les oscillateurs tournent librement, chaque note part d'une phase au hasard. Au-delà, chaque note repart de la même phase (0 à 360°) : l'attaque est identique à chaque note.", tip: "Une phase fixe pour une basse qui frappe toujours pareil sous le kick." },
  drift: { title: 'DRIFT', text: "La part d'analogique : dérive lente des oscillateurs et petits écarts par note (coupure, enveloppes, accord, force). 0 : stable et juste ; 5 : le réglage d'origine ; 10 : le double.", tip: "Un peu plus de DRIFT sur une dark disco lente : la machine respire." },
  width: { title: 'WIDTH', text: "L'écart gauche droite des notes de l'arpège.", tip: "Large avec un DELAY ping-pong : l'arpège tourne autour de la tête." },
  monoLow: { title: 'BASS MONO', text: "Sous cette fréquence (40 à 300 Hz), le son reste au centre et ne passe ni par le chorus, ni par le délai, ni par la réverbe : plus de phase qui se balade dans les graves.", tip: "120 Hz quand l'arpège descend en -1 OCT : le sub reste solide en club." },
  keyTrack: { title: 'KEY TRACK', text: "De combien la coupure suit la note : les notes hautes s'ouvrent plus. À 5, la moitié (le réglage d'origine).", tip: "Plus haut sur 3 OCT : les notes du haut ne s'éteignent plus." },
  accent: { title: 'ACCENT', text: "La force des accents de l'arpège : le « a » de chaque temps plus fort, le « e » plus doux. 0 : tout à plat ; 10 : le double.", tip: "Monte-le pour un groove qui pousse sans toucher au tempo." },
  sync: { title: 'SYNC', text: "OSC 2 repart à chaque cycle d'OSC 1 (hard sync) : il ne bat plus contre lui, son accord devient un timbre qui crie quand RANGE 2 ou SEMI 2 monte.", tip: "SYNC avec MOD sur PITCH : le cri acide sans quitter la note." },
  duck: { title: 'SIDECHAIN', text: "La sortie du MM-ARP, effets compris, s'efface à chaque kick du MM-RYTM et revient avec lui, selon l'enveloppe mesurée du kick joué (son, TUNE, DECAY, vélocité) : jusqu'à -24 dB au coup.", tip: "-6 à -10 dB : le pompage de l'indie dance, sans compresseur." },
  chord: { title: 'CHORD', text: "Les notes de chaque accord : BASIC (la triade depuis sa racine, l'arpège d'origine), TRIAD, 7TH, 9TH ou 11TH : les accords posés dans la même octave, chacun au plus près du précédent, les extensions au-dessus.", tip: "7TH ou 9TH en UP/DN : les arpèges de la dark disco qui sonnent riches sans effort." },

  /* ---------- les touches et l'ecran ---------- */
  pad: { title: 'CHORD PADS', text: "Huit accords de fa dièse mineur, la tonalité de Mika : un pad touché entre dans la progression (un accord par mesure, dans l'ordre des tapes, huit au plus), retouché il en sort. Le premier lance l'arpège. Toutes les notes sont dans la gamme. Touches A à K.", tip: "F#m, D, A, E : la progression qui marche à tous les coups en indie dance." },
  run: { title: 'RUN/STOP', text: "Lance ou arrête l'arpège sans toucher à la progression (vide, il part sur F#m). Il se cale sur la grille du MM-RYTM s'il joue ; sinon c'est le MM-RYTM qui le rejoindra. Espace.", tip: "Lance l'arpège sur le premier temps du MM-RYTM : tout reste en phase." },
  clear: { title: 'CLEAR', text: "Vide la progression, arrête l'arpège et met les effets à 0 (OVERDRIVE, CHORUS, DELAY, REVERB) : le son repart à sec, VOLUME et le son du synthé restent. Avec EDIT ouvert, il rend la suite des potards (tes notes restent en mémoire, les effets ne bougent pas).", tip: "CLEAR puis un seul pad : le drop sur un accord, à sec." },
  random: { title: 'RANDOM', text: "Un style au hasard (BASSLINE, ACID, PLUCK, LEAD, DARK, ARP ; jamais le même deux fois de suite) et tout le patch qui lui ressemble, VOLUME gardé ; une progression toute faite.", tip: "Appuie jusqu'à ce qu'un son t'accroche, puis garde-le en preset (touche l'écran, SAVE)." },
  edit: { title: 'EDIT', text: "Ouvre la suite de l'arpège : au desktop un écran monte à la place des pads, au téléphone un panneau s'ouvre en bas. Dessine tes notes, touche le nom d'une note pour un silence. Touche E.", tip: "Copie la suite des potards puis déplace deux ou trois notes : une mélodie à toi en dix secondes." },
  open: { title: 'OPEN', text: "Soulève le capot : sous lui, la plaque des TWEAKS (PHASE, DRIFT, WIDTH, BASS MONO, KEY TRACK, ACCENT, SYNC, SIDECHAIN, CHORD) et la touche SCOPE. Touche O.", tip: "Les TWEAKS se règlent une fois pour toutes : SIDECHAIN et BASS MONO d'abord." },
  screen: { title: 'MM-ARP', text: "L'écran montre l'arpège : la lecture, l'accord qui joue et sa clé Camelot, le tempo, l'échelle des notes (la tête de lecture, la durée de chaque note), la progression des huit pads, et le dernier potard touché avec sa valeur de 0 à 127. Le toucher ouvre les presets.", tip: "Garde un œil sur la bande des accords : l'accord en négatif est celui qui sonne." },
  presets: { title: 'PRESETS', text: "Le mode presets sur l'écran : à gauche le précédent, à droite le suivant (rechargé aussitôt), en bas SAVE, NAME, DEL (deux fois) et EXIT. Les presets d'usine suivent les tiens.", tip: "SAVE avant d'expérimenter : tu reviens d'une tape." },
  seq: { title: 'SEQUENCE', text: "La suite de l'arpège, une colonne par pas (1 à 16) : glisse pour dessiner les notes (les pas traversés suivent la ligne), touche un nom pour un silence, STEPS - et + pour la longueur. Les filets marquent les notes de l'accord.", tip: "Garde les notes sur les filets : la suite suit chaque accord de la progression sans sonner faux." },
  infos: { title: 'INFOS', text: "Allume l'aide : survole une commande du MM-ARP (au téléphone, touche-la) pour lire ce qu'elle fait, avec son dessin en direct. Le i se remplit tant que l'aide est allumée. I, ou Échap pour l'éteindre.", tip: "Au téléphone, un glisser sur un potard le tourne toujours, la carte suit." },
};

export const VOY_INFOS: Readonly<Record<VoyInfoId, VoyInfo>> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, { ...v, section: VOY_INFO_SECTION[k as VoyInfoId], text: fr(v.text), tip: v.tip ? fr(v.tip) : undefined }])
) as Record<VoyInfoId, VoyInfo>;

/** L'id des INFOS d'une zone de saisie : voyager/infoIds.ts (reexporte ici pour les anciens imports). */
export { voyInfoIdOf } from './infoIds';
