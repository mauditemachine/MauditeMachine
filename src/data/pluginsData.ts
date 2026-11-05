// Données complètes des plugins de Mika (Ableton Live / Studio Maudite Machine)
export interface PluginItem {
  id: string;
  name: string;
  brand: string;
  category: 'synths' | 'dynamics' | 'eq-space' | 'reverb-delay' | 'modulation-creative';
  formats: string[];
  role: string;
  description: string;
  mikaUsage: string;
  keyFeatures: string[];
  isFavorite: boolean;
  image: string | null;
}

export const PLUGIN_CATEGORIES = [
  { id: 'all', label: 'Tous les plugins' },
  { id: 'synths', label: 'Synthétiseurs & Instruments' },
  { id: 'dynamics', label: 'Dynamique & Saturation' },
  { id: 'eq-space', label: 'Égalisation, Mix & Stéréo' },
  { id: 'reverb-delay', label: 'Réverbes & Délais' },
  { id: 'modulation-creative', label: 'Modulation & Glitch' },
] as const;

export const PLUGINS_DATA: PluginItem[] = [
  {
    "id": "tb-303",
    "name": "Roland TB-303",
    "brand": "Roland Cloud",
    "category": "synths",
    "query": "Roland Cloud TB-303 plugin GUI interface screenshot",
    "fallbackQuery": "Roland TB-303 VST screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur de basse acid légendaire",
    "description": "L'émulation officielle par Roland du synthétiseur de basse qui a défini la musique Acid House et Techno. Modélisation ACB (Analog Circuit Behavior) recréant chaque nuance du circuit original.",
    "mikaUsage": "Incontournable pour les acid lines saturées, les slides frénétiques et les séquences hypnotiques de Maudite Machine.",
    "keyFeatures": [
      "Modélisation ACB précise du filtre diode ladder 18 dB/octave",
      "Comportement authentique des accents et slides",
      "Séquenceur interne moderne avec randomisation et arpèges"
    ],
    "isFavorite": true,
    "image": "/images/plugins/tb-303.jpg"
  },
  {
    "id": "sh-101",
    "name": "Roland SH-101",
    "brand": "Roland Cloud",
    "category": "synths",
    "query": "Roland Cloud SH-101 plugin GUI interface screenshot",
    "fallbackQuery": "Roland SH-101 VST GUI screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur mono analogique punchy",
    "description": "Le son de basse et de lead instantané des années 80 et 90. Un seul oscillateur avec mixage sub-oscillateur, noise et onde carrée/dent de scie.",
    "mikaUsage": "Parfait pour les basses rondes et tranchantes qui tiennent le mix techno sans encombrer les sous-graves.",
    "keyFeatures": [
      "Architecture à oscillateur unique ultra-rapide à régler",
      "Filtre résonant auto-oscillant distinctif",
      "Enveloppe ultra-rapide idéale pour percussions et basses"
    ],
    "isFavorite": true,
    "image": "/images/plugins/sh-101.jpg"
  },
  {
    "id": "juno-106",
    "name": "Roland JUNO-106",
    "brand": "Roland Cloud",
    "category": "synths",
    "query": "Roland Cloud JUNO-106 plugin GUI screenshot",
    "fallbackQuery": "Roland Juno 106 VST interface",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur polyphonique 6 voix légendaire",
    "description": "Le polysynth Roland le plus emblématique, célèbre pour ses nappes planantes, ses stabs chauds et son double circuit de Chorus analogique indémodable.",
    "mikaUsage": "Nappes électro-cyberpunk, accords chaleureux et textures rétro-futuristes larges.",
    "keyFeatures": [
      "6 voix de polyphonie analogique ACB",
      "Chorus I et II stéréo iconique",
      "Filtre passe-haut à 4 positions pour nettoyer les graves"
    ],
    "isFavorite": true,
    "image": "/images/plugins/juno-106.jpg"
  },
  {
    "id": "moog-mariana",
    "name": "Moog Mariana",
    "brand": "Moog Music",
    "category": "synths",
    "query": "Moog Mariana bass synth plugin GUI screenshot",
    "fallbackQuery": "Moog Mariana software synthesizer interface",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur de basse moderne multi-couches",
    "description": "La vision moderne de Moog pour les basses électroniques. Deux couches de synthèse indépendantes (Synth 1 et Synth 2) avec sommation de sous-grave chirurgicale et saturation analogique.",
    "mikaUsage": "L'arme absolue pour sculpter des sub-basses monstrueuses et dynamiques qui résonnent sur gros sound-systems.",
    "keyFeatures": [
      "Deux synthétiseurs en un avec traitement de sub dédié",
      "Filtres Moog légendaires (Ladder et multimode)",
      "Matrice de modulation avancée et processeur d'effets intégré"
    ],
    "isFavorite": true,
    "image": "/images/plugins/moog-mariana.jpg"
  },
  {
    "id": "legend-hz",
    "name": "The Legend HZ",
    "brand": "Synapse Audio & Hans Zimmer",
    "category": "synths",
    "query": "Synapse Audio The Legend HZ Hans Zimmer GUI screenshot",
    "fallbackQuery": "The Legend HZ plugin interface",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Minimoog étendu à 6 oscillateurs de Hans Zimmer",
    "description": "Développé en collaboration étroite avec le compositeur de légende Hans Zimmer. Reprend l'émulation Minimoog ultime de Synapse et y ajoute 6 oscillateurs, une matrice de modulation et le banc de filtres Moog 914.",
    "mikaUsage": "Basses colossales, drones sombres et textures cinématographiques massives.",
    "keyFeatures": [
      "6 oscillateurs modélisés composant par composant",
      "Banque de filtres fixes Moog 914 légendaire",
      "Unison et polyphonie étendus pour sound design épique"
    ],
    "isFavorite": true,
    "image": "/images/plugins/legend-hz.jpg"
  },
  {
    "id": "repro-1",
    "name": "u-he Repro-1",
    "brand": "u-he",
    "category": "synths",
    "query": "u-he Repro-1 plugin GUI interface screenshot",
    "fallbackQuery": "uhe Repro 1 VST screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Émulation composant par composant du Sequential Pro-One",
    "description": "Considéré comme l'une des émulations logicielles de synthétiseur analogique les plus fidèles jamais créées. Son brut, agressif et organique incomparable.",
    "mikaUsage": "Séquences techno sombres, stabs agressifs et arpèges énergiques avec son séquenceur pas-à-pas vintage.",
    "keyFeatures": [
      "Modélisation au niveau des circuits intégrés CEM originaux",
      "Séquenceur 64 pas authentique avec glides",
      "Section d'effets intégrée (wavefolder, delay, réverb)"
    ],
    "isFavorite": true,
    "image": "/images/plugins/repro-1.jpg"
  },
  {
    "id": "repro-5",
    "name": "u-he Repro-5",
    "brand": "u-he",
    "category": "synths",
    "query": "u-he Repro-5 plugin GUI interface screenshot",
    "fallbackQuery": "uhe Repro 5 VST screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Émulation du Sequential Prophet-5 à 8 voix",
    "description": "Toute la majesté du Prophet-5 polyphonique de Dave Smith avec jusqu'à 8 voix, un son chaud, vivant et des modulations poly-mod complexes.",
    "mikaUsage": "Accords profonds, cuivres synthétiques vintage et ambiances immersives.",
    "keyFeatures": [
      "Son de circuit analogique non-linéaire ultra-vivant",
      "Section Poly-Mod pour timbres métalliques et FM",
      "Microtuning et contrôle de dérive analogique"
    ],
    "isFavorite": true,
    "image": "/images/plugins/repro-5.jpg"
  },
  {
    "id": "korg-ms20",
    "name": "Korg MS-20",
    "brand": "KORG Collection",
    "category": "synths",
    "query": "Korg Collection MS-20 plugin GUI interface screenshot",
    "fallbackQuery": "Korg MS-20 VST GUI screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Synthétiseur semi-modulaire agressif et rugueux",
    "description": "Le fameux synthé semi-modulaire japonais de 1978. Réputé pour son double filtre passe-haut et passe-bas ultra-résonant capable d'auto-oscillation violente.",
    "mikaUsage": "Leads stridents, hurlements industriels, basses crasseuses et effets de bruitage déstructurés.",
    "keyFeatures": [
      "Filtres résonants KORG K-35 légendaires",
      "Panneau de patch virtuel pour routages complexes",
      "Processeur de signal externe modélisé"
    ],
    "isFavorite": true,
    "image": "/images/plugins/korg-ms20.jpg"
  },
  {
  "id": "serum-2",
  "name": "Xfer Serum 2",
  "brand": "Xfer Records",
  "category": "synths",
  "formats": [
    "AU",
    "VST3"
  ],
  "role": "Synthétiseur à tables d'ondes de référence mondiale",
  "description": "Le roi incontesté de la musique électronique moderne. Tables d'ondes éditables en temps réel, filtres spectraux, propreté audio exceptionnelle et flexibilité infinie.",
  "mikaUsage": "Design de drops, leads futuristes, plucks hyper précis et basses modulées.",
  "keyFeatures": [
    "Moteur de rendu sans aliasing (interpolations haute résolution)",
    "Générateur et importateur de tables d'ondes sur mesure",
    "Matrice de modulation drag-and-drop ultra-visuelle"
  ],
  "isFavorite": true,
  "image": "/images/plugins/serum-2.jpg"
},
  {
    "id": "vital",
    "name": "Vital",
    "brand": "Matt Tytel",
    "category": "synths",
    "query": "Vital spectral warping wavetable synth GUI screenshot",
    "fallbackQuery": "Vital synth user interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Synthétiseur spectral à tables d'ondes animé",
    "description": "Synthétiseur wavetable spectral moderne avec retour visuel à 60 fps. Déformation spectrale, morphing d'oscillateurs et modulation par micro-animations.",
    "mikaUsage": "Textures modernes, sons percutants et évolutions spectrales en synchro d'horloge.",
    "keyFeatures": [
      "Warps spectraux uniques (forme, phase, FM, vocodeur)",
      "Visualisation temps réel de toutes les modulations",
      "Micro-tuning et support MPE complet"
    ],
    "isFavorite": true,
    "image": "/images/plugins/vital.jpg"
  },
  {
    "id": "phase-plant",
    "name": "Phase Plant",
    "brand": "Kilohearts",
    "category": "synths",
    "query": "Kilohearts Phase Plant plugin GUI interface screenshot",
    "fallbackQuery": "Phase Plant Kilohearts screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur modulaire hybride ouvert",
    "description": "Environnement de synthèse semi-modulaire modulaire où l'on assemble librement générateurs (analogique, wavetable, sampleur, noise), modulations et racks de Snap-ins Kilohearts.",
    "mikaUsage": "Création de sons impossibles sur d'autres synthés, percussions modulées et fx glitchés.",
    "keyFeatures": [
      "Architecture modulaire sans limites de blocs",
      "Routage FM et PM entre n'importe quel oscillateur",
      "Intégration transparente de tous les effets Snap-in Kilohearts"
    ],
    "isFavorite": true,
    "image": "/images/plugins/phase-plant.jpg"
  },
  {
    "id": "omnisphere",
    "name": "Omnisphere 2",
    "brand": "Spectrasonics",
    "category": "synths",
    "query": "Spectrasonics Omnisphere 2 plugin GUI interface screenshot",
    "fallbackQuery": "Omnisphere 2 interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Station de sound-design et synthèse universelle",
    "description": "Le vaisseau amiral de Spectrasonics. Plus de 14 000 sons, intégration de synthétiseurs hardware physiques, et moteur de synthèse wavetable/échantillonné démesuré.",
    "mikaUsage": "Bandes-son, intros cinématographiques, textures organiques et sonorités hybrides complexes.",
    "keyFeatures": [
      "Bibliothèque géante d'échantillons psychoacoustiques rares",
      "Synthèse granulaire et FM avancée",
      "Intégration matérielle avec les synthés hardware de studio"
    ],
    "isFavorite": true,
    "image": "/images/plugins/omnisphere.jpg"
  },
  {
    "id": "trilian",
    "name": "Trilian",
    "brand": "Spectrasonics",
    "category": "synths",
    "query": "Spectrasonics Trilian bass module plugin GUI screenshot",
    "fallbackQuery": "Trilian Spectrasonics interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Module total pour basses acoustiques, électriques et synthés",
    "description": "Le standard de l'industrie pour la basse. Contient des multisamples haute définition de légendes comme le Minimoog, Roland Taurus, basses fretless, contrebaisses et chapman stick.",
    "mikaUsage": "Sous-basse organique, transitions réalistes et fondations de groove indéboulonnables.",
    "keyFeatures": [
      "Échantillonnage Round-Robin ultra-détaillé de basses réelles",
      "Section Core Synth dédiée aux basses de synthétiseur",
      "Contrôles dédiés d'attaque de médiator, bruits de frette et glissandi"
    ],
    "isFavorite": true,
    "image": "/images/plugins/trilian.jpg"
  },
  {
    "id": "sylenth1",
    "name": "Sylenth1",
    "brand": "LennarDigital",
    "category": "synths",
    "query": "LennarDigital Sylenth1 plugin GUI interface screenshot",
    "fallbackQuery": "Sylenth1 VST interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Synthétiseur virtuel analogique taillé pour le dancefloor",
    "description": "Une légende qui traverse les décennies. Réputé pour la pureté de ses oscillateurs, son filtre doux et son unison dévastateur capable d'empiler des dizaines de voix avec zéro aliasing.",
    "mikaUsage": "Plucks incisifs, supersaws énergiques et stabs perçants dans les drops électro.",
    "keyFeatures": [
      "4 oscillateurs avec jusqu'à 16 voix d'unison chacun (64 voix par note)",
      "2 filtres résonants chaleureux avec distorsion interne",
      "Consommation CPU quasi-nulle"
    ],
    "isFavorite": true,
    "image": "/images/plugins/sylenth1.jpg"
  },
  {
    "id": "spire",
    "name": "Spire 1.5",
    "brand": "Reveal Sound",
    "category": "synths",
    "query": "Reveal Sound Spire plugin GUI interface screenshot",
    "fallbackQuery": "Spire 1.5 synth interface screenshot",
    "formats": [
      "AU",
      "VST"
    ],
    "role": "Synthétiseur polyphonique hybride trance & techno",
    "description": "Synthé moderne renommé pour son grain brillant, sa résonance cristalline et ses moteurs d'oscillateurs flexibles (Classic, Noise, FM, AMSync, HardFM).",
    "mikaUsage": "Arpèges étincelants, accords futuristes et leads épiques qui passent à travers n'importe quel mur de son.",
    "keyFeatures": [
      "4 oscillateurs multimodes avec wave shaping",
      "2 filtres multimodes avec saturation et émulations de filtres célèbres",
      "Effets intégrés puissants (Phaser, Vowel, Flanger, Reverb, Delay)"
    ],
    "isFavorite": true,
    "image": "/images/plugins/spire.jpg"
  },
  {
    "id": "dune-3",
    "name": "DUNE 3",
    "brand": "Synapse Audio",
    "category": "synths",
    "query": "Synapse Audio DUNE 3 plugin GUI interface screenshot",
    "fallbackQuery": "Dune 3 VST GUI screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur unison et wavetable haut de gamme",
    "description": "Conçu pour la qualité sonore absolue. Double moteur d'arpeggiateur, filtres analogiques à retour zéro délai et son unison pouvant aller jusqu'à 520 oscillateurs par note sans aliasing.",
    "mikaUsage": "Pads riches, nappes immersives et sons d'ambiance à dynamique cinématographique.",
    "keyFeatures": [
      "Double filtre multimode à résonance liquide avec routage série/parallèle",
      "Générateur d'arpeggios complexe avec import de séquences MIDI",
      "Éditeur de tables d'ondes complet avec formules mathématiques"
    ],
    "isFavorite": true,
    "image": "/images/plugins/dune-3.jpg"
  },
  {
    "id": "kick-3",
    "name": "Kick 3",
    "brand": "Sonic Academy",
    "category": "synths",
    "query": "Sonic Academy Kick 3 plugin GUI interface screenshot",
    "fallbackQuery": "Sonic Academy Kick 2 plugin interface",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur et sculpteur de grosses caisses (Kick)",
    "description": "L'outil roi de l'ingénierie du kick. Permet de synthétiser la partie sub avec pitch bend millimétré et d'empiler plusieurs couches de clicks et de transitoires échantillonnées.",
    "mikaUsage": "Créer le kick parfait accordé à la note exacte du morceau, sans conflit de phase avec la basse.",
    "keyFeatures": [
      "Contrôle total des courbes de pitch et d'amplitude avec nœuds précis",
      "Alignement de phase automatique entre transitoire et sub",
      "Visualiseur de spectre et saturation analogique modélisée"
    ],
    "isFavorite": true,
    "image": "/images/plugins/kick-3.jpg"
  },
  {
    "id": "xln-life",
    "name": "Life",
    "brand": "XLN Audio",
    "category": "synths",
    "query": "XLN Audio Life plugin GUI interface screenshot",
    "fallbackQuery": "XLN Life plugin interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Générateur de grooves rythmiques à partir de la vie réelle",
    "description": "Capture les bruits du quotidien via mobile ou DAW Recorder, et les découpe instantanément en éléments de batterie rythmés grâce au machine learning.",
    "mikaUsage": "Injecter des percussions organiques uniques et des textures vivantes dans des boucles de batterie techno.",
    "keyFeatures": [
      "Capture instantanée sans fil via application smartphone dédiée",
      "Segmentation automatique des transitoires par IA",
      "Moteur de variations infinies et de shuffle groove"
    ],
    "isFavorite": true,
    "image": "/images/plugins/xln-life.jpg"
  },
  {
    "id": "gforce-axxess",
    "name": "Axxess",
    "brand": "GForce Software",
    "category": "synths",
    "query": "GForce Axxess synth plugin GUI interface screenshot",
    "fallbackQuery": "GForce Software Axxess interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Émulation moderne de l'ARP Axxe de 1975",
    "description": "Recréation fidèle et modernisée du synthé mono vintage américain. Filtre 24dB 4075 chaud et rond, sous-oscillateur et séquenceur pas-à-pas polyrythmique.",
    "mikaUsage": "Lignes de synthé funky, séquences analogiques brutes et sons percussifs incisifs.",
    "keyFeatures": [
      "Modélisation du filtre légendaire 4075",
      "Séquenceur X-Modifiers moderne et puissant",
      "Effets stéréo intégrés (Delay et Chorus)"
    ],
    "isFavorite": true,
    "image": "/images/plugins/gforce-axxess.jpg"
  },
  {
    "id": "baby-audio-ba-1",
    "name": "BA-1",
    "brand": "Baby Audio",
    "category": "synths",
    "query": "Baby Audio BA-1 synthesizer plugin GUI screenshot",
    "fallbackQuery": "Baby Audio BA 1 plugin interface",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Hommage lofi-analogique au Yamaha CS01",
    "description": "Inspiré du célèbre synthé compact des années 80. Grain brut, circuit analogique jouet avec option 'Battery Drain', haut-parleur miniature émulé et modulation FM.",
    "mikaUsage": "Sons d'accroche lo-fi, mélodies synthwave délavées et basses crunchy.",
    "keyFeatures": [
      "Bouton 'Battery' simulant la perte de tension et le dérèglement sonore",
      "Simulation de haut-parleur physique vintage",
      "Générateur de patchs 'Re-Gen' intelligent"
    ],
    "isFavorite": true,
    "image": "/images/plugins/baby-audio-ba-1.jpg"
  },
  {
    "id": "tal-bassline-101",
    "name": "TAL-BassLine-101",
    "brand": "TAL Software",
    "category": "synths",
    "query": "TAL-BassLine-101 plugin GUI interface screenshot",
    "fallbackQuery": "TAL BassLine 101 VST interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Émulation pure et directe du Roland SH-101",
    "description": "Modélisation précise du synthétiseur de basse analogique le plus populaire de la techno des années 90, avec séquenceur pas-à-pas et résonance sans compromis.",
    "mikaUsage": "Le go-to rapide pour caler une basse percutante sans latence et programmer des motifs au tempo.",
    "keyFeatures": [
      "Filtre passe-bas résonant sans boucle de rétroaction (zéro latence)",
      "Séquenceur 96 pas avec enregistrement temps réel ou pas à pas",
      "Consommation CPU ultra-légère"
    ],
    "isFavorite": true,
    "image": "/images/plugins/tal-bassline-101.jpg"
  },
  {
    "id": "synplant-2",
    "name": "Synplant 2",
    "brand": "Sonic Charge",
    "category": "synths",
    "query": "Sonic Charge Synplant 2 plugin GUI interface screenshot",
    "fallbackQuery": "Synplant 2 Sonic Charge interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Synthétiseur organique génétique à apprentissage machine",
    "description": "Une révolution du sound-design basée sur la pousse de branches génétiques autour d'une graine sonore. La fonction Genopatch recrée n'importe quel son audio via IA.",
    "mikaUsage": "Génération de textures extraterrestres, bleeps futuristes et réinterprétation génétique d'échantillons.",
    "keyFeatures": [
      "Moteur Genopatch utilisant des réseaux de neurones pour synthétiser des sons réels",
      "Croissance organique de variations sans tourner de potentiomètres",
      "Moteur audio sous-jacent puissant et modulable"
    ],
    "isFavorite": true,
    "image": "/images/plugins/synplant-2.jpg"
  },
  {
    "id": "microtonic",
    "name": "Microtonic",
    "brand": "Sonic Charge",
    "category": "synths",
    "query": "Sonic Charge Microtonic drum machine plugin GUI screenshot",
    "fallbackQuery": "Microtonic plugin interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Boîte à rythmes synthétique algorithmique mythique",
    "description": "Boîte à rythmes 100% synthétisée créée par Magnus Lidström (le cerveau derrière le Teenage Engineering OP-1). Des transitoires chirurgicales et un son incisif unique.",
    "mikaUsage": "Percussions synthétiques électroniques, snares claquantes et sons de drums minimaux qui percent le mix.",
    "keyFeatures": [
      "8 voix de synthèse percussive entièrement modélisée sans samples",
      "Patternarium : évolution génétique de rythmes dans le cloud",
      "Séquenceur pas-à-pas dynamique avec accents et morphing"
    ],
    "isFavorite": true,
    "image": "/images/plugins/microtonic.jpg"
  },
  {
    "id": "knifonium",
    "name": "Knif Audio Knifonium",
    "brand": "Brainworx / Plugin Alliance",
    "category": "synths",
    "query": "Knif Audio Knifonium plugin GUI interface screenshot",
    "fallbackQuery": "Knifonium Brainworx interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Synthétiseur monophonique à 26 lampes réelles",
    "description": "Émulation logicielle du synthétiseur à tubes à vide le plus cher au monde. Chaque étage est alimenté par une saturation de lampe authentique et imprévisible.",
    "mikaUsage": "Distorsions riches, solos de synthé chaotiques et résonances organiques épaisses.",
    "keyFeatures": [
      "26 tubes à vide modélisés avec tolérance de composants TMT",
      "Filtre échelle à lampes 4 pôles avec résonance indomptable",
      "Section d'effets Brainworx intégrée"
    ],
    "isFavorite": true,
    "image": "/images/plugins/knifonium.jpg"
  },
  {
    "id": "uadx-minimoog",
    "name": "UADx Moog Minimoog",
    "brand": "Universal Audio",
    "category": "synths",
    "query": "Universal Audio UADx Minimoog plugin GUI screenshot",
    "fallbackQuery": "UAD Minimoog plugin interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Émulation certifiée par Moog Music du modèle D",
    "description": "La reproduction la plus rigoureuse du synthé le plus iconique du 20e siècle. Émule la distorsion de l'entrée externe rebouclée et l'instabilité thermique des oscillateurs originaux.",
    "mikaUsage": "Le son de basse funk/techno originel avec une assise dans le grave que peu de plugins atteignent.",
    "keyFeatures": [
      "Modélisation certifiée par Bob Moog Music",
      "Filtre Ladder 24 dB à transistors discret",
      "Overdrive de l'ampli de sortie et réaction des oscillateurs non-linéaire"
    ],
    "isFavorite": true,
    "image": "/images/plugins/uadx-minimoog.jpg"
  },
  {
    "id": "fabfilter-pro-l2",
    "name": "FabFilter Pro-L 2",
    "brand": "FabFilter",
    "category": "dynamics",
    "query": "FabFilter Pro-L 2 limiter plugin GUI screenshot",
    "fallbackQuery": "FabFilter Pro L 2 interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Limiteur de mastering et mesure de loudness de référence",
    "description": "Le limiteur le plus réputé du mastering professionnel. Offre 8 algorithmes distincts (Modern, Punchy, Dynamic, Transparent...), une protection True Peak et un affichage temps réel spectaculaire.",
    "mikaUsage": "Loudness maximal sur le master sans écraser la dynamique du kick et du sub.",
    "keyFeatures": [
      "8 algorithmes de limitation avancés",
      "Mesure LUFS temps réel EBU R128 et ITU-R BS.1770",
      "Suréchantillonnage linéaire de phase jusqu'à 32x"
    ],
    "isFavorite": true,
    "image": "/images/plugins/fabfilter-pro-l2.jpg"
  },
  {
    "id": "fabfilter-pro-mb",
    "name": "FabFilter Pro-MB",
    "brand": "FabFilter",
    "category": "dynamics",
    "query": "FabFilter Pro-MB multiband compressor GUI screenshot",
    "fallbackQuery": "FabFilter Pro MB interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Compresseur / expandeur multibande chirurgical",
    "description": "Réinvente la dynamique multibande en permettant de créer des bandes n'importe où dans le spectre sans diviser artificiellement l'ensemble du signal.",
    "mikaUsage": "Contrôler le bas de spectre de la basse sans étouffer la brillance, ou compresser les hauts médiums agressifs.",
    "keyFeatures": [
      "Placement libre des bandes de fréquences",
      "Modes Dynamic Phase, Linear Phase et Minimum Phase",
      "Sidechain externe et déclenchement fréquentiel par bande"
    ],
    "isFavorite": true,
    "image": "/images/plugins/fabfilter-pro-mb.jpg"
  },
  {
    "id": "fabfilter-saturn2",
    "name": "FabFilter Saturn 2",
    "brand": "FabFilter",
    "category": "dynamics",
    "query": "FabFilter Saturn 2 distortion plugin GUI screenshot",
    "fallbackQuery": "FabFilter Saturn 2 interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Saturateur multibande et modélisateur harmonique",
    "description": "L'outil ultime pour colorer, épaissir et détruire le son. De la chaleur subtile de bande magnétique aux distorsions numériques tubesques violentes sur jusqu'à 6 bandes.",
    "mikaUsage": "Ajouter de la présence aux basses pour qu'elles s'entendent sur enceintes de téléphone et donner du mordant aux drums.",
    "keyFeatures": [
      "28 styles de distorsion différents (Tubes, Tape, Amp, Rectify...)",
      "Traitement multibande jusqu'à 6 bandes indépendantes",
      "Matrice de modulation visuelle avec LFOs et suiveurs d'enveloppe"
    ],
    "isFavorite": true,
    "image": "/images/plugins/fabfilter-saturn2.jpg"
  },
  {
    "id": "soundtoys-decapitator",
    "name": "Soundtoys Decapitator",
    "brand": "Soundtoys",
    "category": "dynamics",
    "query": "Soundtoys Decapitator analog saturation plugin GUI screenshot",
    "fallbackQuery": "Decapitator Soundtoys interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Saturateur analogique à modélisation de préamplis",
    "description": "Cinq styles de saturation analogique différents modélisés d'après des consoles et préamplis cultes (Ampex, Neve, EMI, etc.) avec le redoutable bouton 'PUNISH' pour une distorsion extrême.",
    "mikaUsage": "Épaissir instantanément un son de synthé, donner du corps à un drum bus et salir avec classe.",
    "keyFeatures": [
      "5 modèles de préamplis hardware distincts (A, E, N, T, P)",
      "Bouton 'Punish' ajoutant +20 dB de gain d'entrée",
      "Filtres Tone et High/Low cut musicaux"
    ],
    "isFavorite": true,
    "image": "/images/plugins/soundtoys-decapitator.jpg"
  },
  {
    "id": "standardclip",
    "name": "StandardCLIP",
    "brand": "SIR Audio Tools",
    "category": "dynamics",
    "query": "SIR Audio Tools StandardCLIP plugin GUI screenshot",
    "fallbackQuery": "StandardCLIP plugin interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Clipper dur/doux professionnel avec suréchantillonnage 32x",
    "description": "Le clipper de prédilection des ingénieurs mastering modernes et des producteurs techno/bass music pour couper les crêtes sans aucune distorsion indésirable.",
    "mikaUsage": "Raboter les transitoires de kicks et caisses claires pour gagner jusqu'à 3 dB de headroom avant le limiteur.",
    "keyFeatures": [
      "Suréchantillonnage linéaire jusqu'à 32x",
      "Contrôle de genou réglable de Hard Clip à Soft Clip",
      "Oscilloscope de crête ultra-détaillé"
    ],
    "isFavorite": true,
    "image": "/images/plugins/standardclip.jpg"
  },
  {
    "id": "oxford-inflator",
    "name": "Oxford Inflator",
    "brand": "Sonnox",
    "category": "dynamics",
    "query": "Sonnox Oxford Inflator plugin GUI interface screenshot",
    "fallbackQuery": "Oxford Inflator plugin screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Optimiseur de loudness et de présence harmonique",
    "description": "Procédé secret breveté qui augmente la puissance sonore et la présence perçue sans pompage de compression audible ni perte de dynamique apparente.",
    "mikaUsage": "Donner de l'épaisseur et du volume apparent au bus de mix ou à des éléments clés sans les écraser.",
    "keyFeatures": [
      "Augmente le volume perçu sans compression",
      "Génère des harmoniques de 2e et 3e ordre musicales",
      "Capacité à dépasser le 0 dBFS sans distorsion agressive"
    ],
    "isFavorite": true,
    "image": "/images/plugins/oxford-inflator.jpg"
  },
  {
    "id": "bx-clipper",
    "name": "bx_clipper",
    "brand": "Brainworx / Plugin Alliance",
    "category": "dynamics",
    "query": "Brainworx bx_clipper plugin GUI interface screenshot",
    "fallbackQuery": "bx_clipper Brainworx interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Double clipper crêtes et FET avec traitement Mid/Side",
    "description": "Combine un clipper FET et un clipper de crête pour traiter séparément le centre et les côtés du mixage, garantissant des basses puissantes et des aigus aérés.",
    "mikaUsage": "Écrêtage précis sur le bus de master pour maximiser les LUFS tout en gardant une image stéréo large.",
    "keyFeatures": [
      "Double étage de clipping (FET + Peak)",
      "Traitement indépendant Mid/Side",
      "Fonction Auto-Ceiling pour éviter les dépassements"
    ],
    "isFavorite": true,
    "image": "/images/plugins/bx-clipper.jpg"
  },
  {
    "id": "xfer-ott",
    "name": "OTT",
    "brand": "Xfer Records",
    "category": "dynamics",
    "query": "Xfer OTT multiband compressor plugin GUI screenshot",
    "fallbackQuery": "Xfer OTT plugin interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Compresseur multibande ascendant et descendant agressif",
    "description": "Le plugin gratuit le plus légendaire de l'EDM et de l'électro moderne. Recrée le fameux preset 'OTT' du compresseur multibande d'Ableton Live avec compression vers le haut et vers le bas.",
    "mikaUsage": "Faire ressortir les détails cachés, faire briller les leads et donner une énergie explosive instantanée.",
    "keyFeatures": [
      "Compression ascendante (upward) et descendante (downward)",
      "3 bandes de fréquences optimisées pour la musique électronique",
      "Bouton Depth pour doser l'intensité"
    ],
    "isFavorite": true,
    "image": "/images/plugins/xfer-ott.jpg"
  },
  {
    "id": "uadx-1176",
    "name": "UADx 1176 Classic FET Limiter",
    "brand": "Universal Audio",
    "category": "dynamics",
    "query": "Universal Audio UADx 1176 FET compressor plugin GUI screenshot",
    "fallbackQuery": "UAD 1176 compressor interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Le compresseur à transistor FET le plus rapide du monde",
    "description": "L'émulation officielle UA du rack de studio le plus célèbre de l'histoire. Temps d'attaque fulgurant (microsecondes), distorsion harmonique séduisante et mode 'All-Buttons in'.",
    "mikaUsage": "Attaques tranchantes sur snares, percussions et lignes de basse qui doivent rester collées en avant.",
    "keyFeatures": [
      "Attaque ultra-rapide de 20 microsecondes",
      "Mode 'All-Buttons in' pour écrasement harmonique massif",
      "Son chaud de transformateurs d'entrée/sortie réels"
    ],
    "isFavorite": true,
    "image": "/images/plugins/uadx-1176.jpg"
  },
  {
    "id": "uadx-la2a",
    "name": "UADx Teletronix LA-2A",
    "brand": "Universal Audio",
    "category": "dynamics",
    "query": "Universal Audio UADx LA-2A tube compressor plugin GUI screenshot",
    "fallbackQuery": "Teletronix LA-2A plugin interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Compresseur optique à lampes ultra-doux",
    "description": "La référence du compresseur électro-optique à cellule T4. Compression fluide, musicale et chaleureuse qui dépend directement du niveau d'entrée du signal.",
    "mikaUsage": "Adoucir une basse, poser une voix ou donner un sustain naturel infini à un synthé.",
    "keyFeatures": [
      "Atténuateur optique T4 à réponse dépendante du programme",
      "Amplification à lampes avec distorsion harmonique soyeuse",
      "Simplicité à deux boutons : Peak Reduction et Gain"
    ],
    "isFavorite": true,
    "image": "/images/plugins/uadx-la2a.jpg"
  },
  {
    "id": "uadx-distressor",
    "name": "UADx Empirical Labs Distressor",
    "brand": "Universal Audio",
    "category": "dynamics",
    "query": "Universal Audio UADx Empirical Labs Distressor plugin GUI screenshot",
    "fallbackQuery": "Empirical Labs Distressor plugin interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Compresseur analogique couteau suisse légendaire",
    "description": "Modélisation certifiée par Dave Derr du hardware présent dans tous les grands studios du monde. Capable d'émuler un 1176, un LA-2A ou une compression agressive avec distorsion 2e et 3e harmoniques.",
    "mikaUsage": "Faire claquer les drums, écraser les pièces de batterie et contrôler les basses rebelles.",
    "keyFeatures": [
      "Modes de distorsion harmonique Dist 2 (tube) et Dist 3 (bande)",
      "Mode 'Nuke' pour une compression destructrice",
      "Filtres sidechain passe-haut et bump 6 kHz intégrés"
    ],
    "isFavorite": true,
    "image": "/images/plugins/uadx-distressor.jpg"
  },
  {
    "id": "dynone-3",
    "name": "DynOne 3",
    "brand": "Leapwing Audio",
    "category": "dynamics",
    "query": "Leapwing Audio DynOne 3 plugin GUI interface screenshot",
    "fallbackQuery": "Leapwing DynOne 3 interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Compresseur parallèle multibande haute résolution",
    "description": "Conçu pour appliquer une compression parallèle subtile et chirurgicale sur 5 bandes avec filtres à phase linéaire parfaits. Apporte une densité inouïe sans jamais dénaturer le mix.",
    "mikaUsage": "Mastering et sous-groupes pour densifier les morceaux sans écraser les transitoires.",
    "keyFeatures": [
      "5 bandes avec filtres à phase linéaire transparents",
      "Contrôles intelligents de temps d'attaque/relâchement pondérés",
      "Traitement Center/Side indépendant"
    ],
    "isFavorite": true,
    "image": "/images/plugins/dynone-3.jpg"
  },
  {
    "id": "fabfilter-pro-q3",
    "name": "FabFilter Pro-Q 3 / Pro-Q 4",
    "brand": "FabFilter",
    "category": "eq-space",
    "query": "FabFilter Pro-Q 3 equalizer plugin GUI screenshot",
    "fallbackQuery": "FabFilter Pro Q 3 interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "L'égaliseur paramétrique le plus utilisé au monde",
    "description": "L'outil roi de l'égalisation numérique : jusqu'à 24 bandes dynamiques, traitement Mid/Side, phase linéaire, visualisation spectrale externe pour détecter les conflits de fréquences.",
    "mikaUsage": "Nettoyage chirurgical des basses fréquences, sculpting précis et élimination des résonances agressives.",
    "keyFeatures": [
      "Égalisation dynamique facultative sur chaque bande",
      "Visualisation des collisions fréquentielles avec d'autres pistes",
      "Modes Zero Latency, Natural Phase et Linear Phase"
    ],
    "isFavorite": true,
    "image": "/images/plugins/fabfilter-pro-q3.jpg"
  },
  {
    "id": "trackspacer",
    "name": "Trackspacer",
    "brand": "Wavesfactory",
    "category": "eq-space",
    "query": "Wavesfactory Trackspacer plugin GUI interface screenshot",
    "fallbackQuery": "Wavesfactory Trackspacer interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Égaliseur dynamique sidechain chirurgical 32 bandes",
    "description": "Analyse en temps réel le signal d'une piste externe (ex: un kick) et applique une courbe d'égalisation inverse sur la piste cible (ex: la basse), creusant exactement les fréquences nécessaires.",
    "mikaUsage": "Le secret pour un kick et une basse parfaitement séparés et percutants sans effet de pompage exagéré.",
    "keyFeatures": [
      "32 bandes de réduction dynamique ultra-précises",
      "Filtres passe-bas et passe-haut pour limiter la zone d'action",
      "Contrôle d'attaque, de relâchement et mode Mid/Side"
    ],
    "isFavorite": true,
    "image": "/images/plugins/trackspacer.jpg"
  },
  {
    "id": "basslane-pro",
    "name": "Basslane Pro",
    "brand": "Tone Projects",
    "category": "eq-space",
    "query": "Tone Projects Basslane Pro plugin GUI interface screenshot",
    "fallbackQuery": "Tone Projects Basslane Pro interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Contrôleur et formeur de stéréo du bas de spectre",
    "description": "Le processeur de basses le plus sophistiqué du marché : mono-maker dynamique, élargissement spatial au-dessus du seuil, saturation de sub harmonique et gestion de phase.",
    "mikaUsage": "Garantir un sub 100% mono sous 100 Hz tout en élargissant la texture de la basse dans les médiums.",
    "keyFeatures": [
      "Réduction stéréo dynamique sous une fréquence réglable",
      "Module de saturation analogique adapté au bas du spectre",
      "Outils de mesure de corrélation de phase intégrés"
    ],
    "isFavorite": true,
    "image": "/images/plugins/basslane-pro.jpg"
  },
  {
    "id": "metric-ab",
    "name": "Metric AB",
    "brand": "ADPTR Audio / Plugin Alliance",
    "category": "eq-space",
    "query": "ADPTR Audio Metric AB plugin GUI interface screenshot",
    "fallbackQuery": "Metric AB ADPTR interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "Outil de comparaison A/B de référence pour le mixage",
    "description": "Permet de comparer instantanément son morceau à jusqu'à 16 pistes de référence avec alignement de volume sonore automatique, comparateur de spectre, de dynamique, d'image stéréo et de loudness.",
    "mikaUsage": "Vérifier en un clic si le mix tient la comparaison face aux plus gros bangers club du moment.",
    "keyFeatures": [
      "Alignement automatique du volume sonore (LUFS match)",
      "5 modes d'analyse détaillée (Spectre, Dynamique, Corrélation, Loudness, Filtre)",
      "Commutateur A/B sans latence ni clic"
    ],
    "isFavorite": true,
    "image": "/images/plugins/metric-ab.jpg"
  },
  {
    "id": "valhalla-vintageverb",
    "name": "Valhalla VintageVerb",
    "brand": "Valhalla DSP",
    "category": "reverb-delay",
    "query": "Valhalla DSP VintageVerb plugin GUI interface screenshot",
    "fallbackQuery": "Valhalla VintageVerb interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Réverbe algorithmique vintage inspirée des légendes 70/80",
    "description": "Inspirée des boîtes de réverbération numériques matérielles les plus mythiques (Lexicon 224, 480L, EMT). Propose des modes '1970s', '1980s' et 'NOW' avec dégradation de fréquence d'échantillonnage.",
    "mikaUsage": "Espaces riches, queues de réverbération amples et réverbes de caisse claire amples.",
    "keyFeatures": [
      "Modes d'époques modélisant les convertisseurs 12-bit et 16-bit vintage",
      "Algorithmes variés (Concert Hall, Plate, Sanctuary, Smooth Room)",
      "Interface vectorielle épurée et ultra-lisible"
    ],
    "isFavorite": true,
    "image": "/images/plugins/valhalla-vintageverb.jpg"
  },
  {
    "id": "valhalla-delay",
    "name": "Valhalla Delay",
    "brand": "Valhalla DSP",
    "category": "reverb-delay",
    "query": "Valhalla DSP ValhallaDelay plugin GUI interface screenshot",
    "fallbackQuery": "ValhallaDelay plugin interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Délai classique et créatif multi-modes",
    "description": "Modélisation de délais à bande vintage (Tape), bucket-brigade (BBD), pitch-shifting et reverse delay avec saturation chaleureuse et résonance sans aliasing.",
    "mikaUsage": "Échos dub, delays syncopés stéréo et effets de pitch spatiaux.",
    "keyFeatures": [
      "Modes Tape, HiFi, BBD, Digital, Pitch et Ghost",
      "Contrôles d'écho Era pour son lofi vintage ou ultra-propre",
      "Mode Diffusion pour transformer le delay en réverbe"
    ],
    "isFavorite": true,
    "image": "/images/plugins/valhalla-delay.jpg"
  },
  {
    "id": "valhalla-supermassive",
    "name": "Valhalla Supermassive",
    "brand": "Valhalla DSP",
    "category": "reverb-delay",
    "query": "Valhalla Supermassive plugin GUI interface screenshot",
    "fallbackQuery": "Valhalla Supermassive interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Délai galactique et réverbe pour ambiances infinies",
    "description": "Conçu pour les espaces massifs, les résonances éthérées et les paysages sonores d'une profondeur démesurée grâce à des réseaux de lignes de retard complexes nommés d'après des constellations.",
    "mikaUsage": "Nappes infinies, sound design spatial cyberpunk et retours de délai planants.",
    "keyFeatures": [
      "20 algorithmes uniques (Gemini, Hydra, Sagittarius, etc.)",
      "Densité modulable de delay rythmique à réverbe géante",
      "Feedback harmonique infini auto-oscillant"
    ],
    "isFavorite": true,
    "image": "/images/plugins/valhalla-supermassive.jpg"
  },
  {
    "id": "strymon-bigsky",
    "name": "Strymon BigSky",
    "brand": "Strymon",
    "category": "reverb-delay",
    "query": "Strymon BigSky plugin GUI interface screenshot",
    "fallbackQuery": "Strymon BigSky plugin interface screenshot",
    "formats": [
      "AU",
      "VST3"
    ],
    "role": "La réverbe pédale légendaire portée dans le DAW",
    "description": "Le son de réverbe le plus convoité des guitaristes et producteurs ambient. Des algorithmes cultes comme Bloom, Cloud, Chorale ou Shimmer avec une texture liquide incomparable.",
    "mikaUsage": "Ambiances célestes, réverbes magnétiques sur synthés et queues de réverbes brillantes.",
    "keyFeatures": [
      "12 algorithmes de réverbe de classe studio",
      "Contrôle Decay, Pre-Delay, Tone et Paramètres assignables",
      "Moteur audio Strymon recréé fidèlement à l'identique du DSP matériel"
    ],
    "isFavorite": true,
    "image": "/images/plugins/strymon-bigsky.jpg"
  },
  {
    "id": "devious-infiltrator",
    "name": "Infiltrator 2",
    "brand": "Devious Machines",
    "category": "modulation-creative",
    "query": "Devious Machines Infiltrator 2 plugin GUI interface screenshot",
    "fallbackQuery": "Infiltrator 2 plugin interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Monstre multi-effets à séquençage et modulation modulaire",
    "description": "Une centrale d'effets modulaires permettant d'empiler jusqu'à 10 modules simultanés (filtres, pitch, lo-fi, delay, distorsion, compresseur) séquencés par des courbes dessinables à la main.",
    "mikaUsage": "Glitchs percussifs futuristes, transformations rythmiques d'accords et variations en temps réel.",
    "keyFeatures": [
      "Séquenceur 32 pas par effet avec enveloppes personnalisées",
      "Plus de 50 modules d'effets différents haute qualité",
      "Déclenchement MIDI et suiveurs d'enveloppe intelligents"
    ],
    "isFavorite": true,
    "image": "/images/plugins/devious-infiltrator.jpg"
  },
  {
    "id": "shaperbox-3",
    "name": "ShaperBox 3",
    "brand": "Cableguys",
    "category": "modulation-creative",
    "query": "Cableguys ShaperBox 3 plugin GUI interface screenshot",
    "fallbackQuery": "ShaperBox 3 Cableguys interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Suite de modulation rythmique tout-en-un",
    "description": "Comprend VolumeShaper (sidechain parfait), TimeShaper (effets de scratching, reverse et tape-stop), DriveShaper, NoiseShaper, FilterShaper, LiquidShaper, PanShaper et WidthShaper.",
    "mikaUsage": "Sidechain ultra-propre calé sur le kick, scratching créatif et modulations de filtre rythmées.",
    "keyFeatures": [
      "Dessin de courbes d'enveloppe LFO ultra-précis au pixel près",
      "Déclenchement audio par détection de transitoire ou MIDI",
      "Traitement multibande indépendant sur chaque Shaper"
    ],
    "isFavorite": true,
    "image": "/images/plugins/shaperbox-3.jpg"
  },
  {
    "id": "output-portal",
    "name": "Portal",
    "brand": "Output",
    "category": "modulation-creative",
    "query": "Output Portal granular synthesis FX plugin GUI screenshot",
    "fallbackQuery": "Output Portal plugin interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Synthétiseur granulaire d'effets en temps réel",
    "description": "Découpe n'importe quelle source audio entrante en micro-grains sonores pour la réorganiser dans l'espace avec du pitch, du reverse, des délais et des modulations circulaires.",
    "mikaUsage": "Transformer une mélodie ordinaire en nuage cinématographique texturé et mouvant.",
    "keyFeatures": [
      "Moteur de synthèse granulaire zéro latence",
      "2 macro curseurs XY pour le contrôle en direct",
      "Séquenceur de modulation circulaire avancé"
    ],
    "isFavorite": true,
    "image": "/images/plugins/output-portal.jpg"
  },
  {
    "id": "xln-rc20",
    "name": "RC-20 Retro Color",
    "brand": "XLN Audio",
    "category": "modulation-creative",
    "query": "XLN Audio RC-20 Retro Color plugin GUI interface screenshot",
    "fallbackQuery": "RC-20 Retro Color interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Générateur de texture vintage et coloration analogique",
    "description": "Ajoute instantanément du grain vintage avec 6 modules dédiés : Noise (bruit de fond vinyle/K7), Wobble (pleurage de bande), Distort (saturation), Digital (réduction de résolution), Space (réverbe) et Magnetic.",
    "mikaUsage": "Donner une âme rétro, un léger wobble nostalgique et du grain aux synthés numériques.",
    "keyFeatures": [
      "6 modules d'effets vintage indépendants",
      "Curseur Magnitude global pour doser l'effet en un geste",
      "Simulation fidèle des fluctuations de bande et craquements de microsillon"
    ],
    "isFavorite": true,
    "image": "/images/plugins/xln-rc20.jpg"
  },
  {
    "id": "baby-audio-transit",
    "name": "Transit",
    "brand": "Baby Audio & Andrew Huang",
    "category": "modulation-creative",
    "query": "Baby Audio Transit plugin GUI interface screenshot",
    "fallbackQuery": "Baby Audio Transit interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Créateur de transitions et montées dynamiques",
    "description": "Conçu pour créer des montées de tension, drops et transitions d'énergie avec un seul bouton Macro contrôlant simultanément jusqu'à 18 modules d'effets.",
    "mikaUsage": "Automatiser des build-ups explosifs et des cassures de tempo en fin de cycle de 16 mesures.",
    "keyFeatures": [
      "Macro-knob central contrôlant tous les paramètres simultanément",
      "Modes Motion Sequencer pour tourner en boucle ou transition unique",
      "Bibliothèque riche de presets calibrés pour le club"
    ],
    "isFavorite": true,
    "image": "/images/plugins/baby-audio-transit.jpg"
  },
  {
    "id": "baby-audio-humanoid",
    "name": "Humanoid",
    "brand": "Baby Audio",
    "category": "modulation-creative",
    "query": "Baby Audio Humanoid vocoder plugin GUI interface screenshot",
    "fallbackQuery": "Baby Audio Humanoid interface screenshot",
    "formats": [
      "AU",
      "VST",
      "VST3"
    ],
    "role": "Pitch-shifter et vocodeur vocal robotique futuriste",
    "description": "Combine resynthèse FFT à phase dure et correction de justesse agressive pour transformer des voix ou instruments en sonorités cybernétiques robotiques ultra-modernes.",
    "mikaUsage": "Textures vocales cyberpunk, leads robotiques Maudite Machine et effets futuristes percutants.",
    "keyFeatures": [
      "Oscillateur de resynthèse interne synchronisable sur notes MIDI",
      "Algorithmes de déphasage et de morphing formantique",
      "Filtres et saturations industrielles taillés pour l'électronique"
    ],
    "isFavorite": true,
    "image": "/images/plugins/baby-audio-humanoid.jpg"
  },
  {
    "id": "stepic",
    "name": "Stepic",
    "brand": "Devicemeister",
    "category": "modulation-creative",
    "query": "Devicemeister Stepic VST MIDI sequencer plugin GUI screenshot",
    "fallbackQuery": "Stepic VST interface screenshot",
    "formats": [
      "VST3"
    ],
    "role": "Séquenceur MIDI et modulateur polyrythmique avancé",
    "description": "Séquenceur de pas et générateur de modulations CC MIDI ultra-puissant. Gère les longueurs de patterns indépendantes par piste, probabilités, ratchets et modulations libres.",
    "mikaUsage": "Alimenter les synthés hardwares et virtuels avec des rythmes polyrythmiques hypnotiques.",
    "keyFeatures": [
      "16 pistes de modulation CC indépendantes",
      "Probabilités par pas et répétition de notes (ratcheting)",
      "Polyrythmie complète avec pas individuels par ligne"
    ],
    "isFavorite": true,
    "image": "/images/plugins/stepic.jpg"
  }
];
