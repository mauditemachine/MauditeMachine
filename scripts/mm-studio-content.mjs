/**
 * mm-studio-content.mjs : le texte des pages statiques de MM-STUDIO (la
 * home de la machine, src/v4), en anglais, en francais et en espagnol.
 *
 * 2026-10-11 (referencement, Mika : "je veux que le site soit vraiment tres
 * utilise et remarque par des journaux de news sur la musique electronique,
 * ca doit etre affiche dans les recherches") : la machine 3D n'a pas de
 * texte lisible sans JavaScript ni d'adresse par instrument. Douze pages
 * simples (un hub et trois machines, trois langues) la decrivent pour les
 * moteurs, les assistants et la presse. Une seule source :
 * scripts/prerender-seo.mjs ecrit les pages, scripts/generate-sitemap.mjs
 * les met dans sitemap.xml avec leurs hreflang.
 *
 * Chaque fait a ete relu dans le code le 2026-10-11 avant d'etre ecrit :
 * - MM-RYTM : src/v4/audio/pattern.ts (INSTRUMENTS, STEP_COUNT, BPM 100 a
 *   150), src/v4/rytm/pages.ts (VOICE FLTR ENV FX, FX de voix et globaux),
 *   src/v4/theme.ts (HOLD A STEP: P-LOCK, GLOBAL_ENC_LABELS),
 *   src/v4/audio/kit.ts (couches SYNTH et SAMPLE, modeles 909 808 MM),
 *   public/samples/rytm (samples de Mika, BD et SD), src/v4/rytm/infos.ts
 *   (16 patterns A01 a A16), src/v4/hooks/useKeys.ts (clavier) ;
 * - MM-ARP : src/v4/voyager/params.ts (oscillateurs, SUB, FM, filtre a 4
 *   modes, enveloppes, LFO, OVERDRIVE CHORUS DELAY REVERB, TWEAKS),
 *   src/v4/voyager/chords.ts (8 accords de fa diese mineur),
 *   src/v4/voyager/infos.ts (OPEN : TWEAKS et SCOPE) ;
 * - MM-DECKS : src/v4/ui/OverviewHelp.tsx, src/v4/dj/TrackBrowser.tsx
 *   (TAB_LABEL), src/v4/dj/math.ts (GAIN -12 a +12 dB), src/v4/dj/theme.ts
 *   (EQ HI MID LOW), src/v4/dj/actions.ts (ADD DECK : C puis D) ;
 * - MIDI : src/v4/midi/targets.ts, src/v4/midi/roto.ts, src/v4/midi/midi.ts
 *   (Chrome, Edge, Opera, Firefox ; pas Safari), src/v4/ui/MidiPanel.tsx ;
 * - le reste : src/v4/state/undo.ts et presets.ts (UNDO, SAVE dans le
 *   navigateur), src/v4/scene/renderer.ts (three 0.186 exige WebGL2),
 *   src/v4/fallback/NoWebGL.tsx (repli HTML), src/v4/ui/Hotspots.tsx
 *   (jumeaux HTML), src/v4/state/focus.ts (START_ALIASES : ?m=rytm, ?m=arp,
 *   ?m=decks), src/v4/data.ts MENU_ABOUT (Mika a fait le site et chaque
 *   machine).
 * Jamais ici : la machine cachee (?bass=1) ni celle retiree le 2026-10-07,
 * aucun chiffre d'usage, aucune note ni avis.
 *
 * Forme des liens dans le texte : [texte](/chemin/) ; le prerender les rend
 * en vrais liens absolus (les chemins qui commencent par / prennent
 * https://mauditemachine.com devant).
 */

import { PATTERN_PAGES } from './mm-studio-patterns.mjs';

export const SITE = 'https://mauditemachine.com';

/** Le @id de l'application MM-STUDIO (le hub anglais le decrit, les autres pages le citent). */
export const MM_STUDIO_APP_ID = `${SITE}/mm-studio/#app`;

/** Les machines, leur nom et l'adresse qui les ouvre (src/v4/state/focus.ts START_ALIASES). */
export const MM_STUDIO_MACHINES = {
  hub: { name: 'MM-STUDIO', start: `${SITE}/` },
  rytm: { name: 'MM-RYTM', start: `${SITE}/?m=rytm` },
  arp: { name: 'MM-ARP', start: `${SITE}/?m=arp` },
  decks: { name: 'MM-DECKS', start: `${SITE}/?m=decks` },
};

/**
 * Les captures (T9, 2026-10-11), utilisees si le fichier existe dans
 * public/ : og:image et figure des pages. Pas de capture des platines
 * (pas de Worker SoundCloud en local).
 */
export const MM_STUDIO_SHOTS = {
  og: { path: '/press/mm-studio/og-mm-studio.jpg', width: 1200, height: 630 },
  hub: { path: '/press/mm-studio/mm-studio-overview.jpg', width: 2400, height: 1500 },
  rytm: { path: '/press/mm-studio/mm-studio-rytm.jpg', width: 2400, height: 1500 },
  arp: { path: '/press/mm-studio/mm-studio-arp.jpg', width: 2400, height: 1500 },
};

/**
 * L'alt de l'image d'apercu (og:image:alt, twitter:image:alt), par langue :
 * og-mm-studio.jpg montre les trois machines sur toutes les pages, platines
 * vides comprises. L'imageAlt de chaque page decrit sa figure (la capture de
 * sa famille) ; MM-DECKS n'a pas encore de capture, son imageAlt attend la
 * sienne.
 */
export const MM_STUDIO_OG_ALT = {
  en: 'MM-STUDIO by Maudite Machine: the MM-RYTM drum machine, the MM-ARP synth and the MM-DECKS DJ decks and mixer side by side in 3D',
  fr: 'MM-STUDIO by Maudite Machine : la boîte à rythmes MM-RYTM, le synthé MM-ARP et les platines DJ et la table MM-DECKS côte à côte en 3D',
  es: 'MM-STUDIO by Maudite Machine: la caja de ritmos MM-RYTM, el sintetizador MM-ARP y los platos DJ y la mesa MM-DECKS uno al lado del otro en 3D',
};

/** featureList du JSON-LD (WebApplication), en anglais, les memes faits que le texte. */
export const MM_STUDIO_FEATURES = {
  hub: [
    'MM-RYTM drum machine: 8 voices, 16 steps, parameter locks, 16 patterns',
    'MM-ARP synth: two oscillators and a sub oscillator, ladder filter, arpeggiator, 8 chord pads',
    'MM-DECKS: two to four DJ decks, mixer with EQ and GAIN from -12 to +12 dB, a sampler in each deck',
    'The machines and the decks play in time',
    'MIDI LEARN for every parameter (Web MIDI)',
    'Ready-made Roto-Control setups, downloaded from the MIDI panel and imported in ROTO-SETUP, no MIDI LEARN needed',
    'Presets saved in the browser, UNDO and REDO',
    'Dark and Light appearances',
    'Works on phones, keyboard and screen reader access through HTML twins',
  ],
  rytm: [
    '8 voices: BD, SD, CH, OH, CP, TOM, HT, CY',
    '16 steps with velocity',
    'Parameter locks per step',
    '16 patterns (A01 to A16) that can be chained',
    'SYNTH layer, SAMPLE layer or both on each voice',
    'Voice effects: DIST, CHORUS, DELAY, REVERB',
    'Global effects: DIST, CHORUS, DELAY, REVERB, STRETCH, SWING, BIT, COMP',
    'Tempo from 100 to 150 BPM, MUTE and SOLO',
    'MIDI LEARN, ready-made Roto-Control setups, one of them a step sequencer',
  ],
  arp: [
    'Arpeggiator: RATE 1/4 to 1/32, UP, DOWN, UP/DN, RAND, one to three octaves',
    '8 chord pads in F# minor',
    'Two oscillators, sub oscillator, FM',
    'Filter with four modes: 24 dB ladder low pass, 12 dB low pass, band pass, high pass',
    'Filter and amp envelopes, LFO synced to the tempo',
    'OVERDRIVE, CHORUS, DELAY, REVERB',
    'SIDECHAIN on the MM-RYTM kick, oscilloscope',
    'MIDI LEARN and a ready-made Roto-Control setup',
  ],
  decks: [
    'Two to four DJ decks with CUE, PLAY, loops, pitch and SYNC',
    'Track sources: MAUDITE, SOUNDCLOUD, MY SC, FILES, PLAYLISTS',
    'Mixer with GAIN from -12 to +12 dB, three band EQ, filter, effects and VU meters',
    'MM-RYTM and MM-ARP on the mixer, decks follow their tempo',
    'A sampler in each deck: slices, grains, 16 step sequence, WAV export',
    'MIDI LEARN and two ready-made Roto-Control setups',
  ],
};

/*
 * Les pages. Champs : cluster (hub, rytm, arp, decks), lang, path, title
 * (60 signes au plus), description (120 a 160), h1, lead, sections
 * ({ h2 (null : sans titre), paragraphs, items, ordered }), cta, imageAlt.
 */
export const MM_STUDIO_PAGES = [
  /* ---------- hub ---------- */
  {
    cluster: 'hub',
    lang: 'en',
    path: '/mm-studio/',
    title: 'MM-STUDIO | Free Drum Machine, Synth and DJ Decks Online',
    description:
      'Play a 3D studio in your browser: MM-RYTM drum machine with p-locks, MM-ARP synth with arpeggiator, MM-DECKS DJ decks and mixer. Free, works with MIDI.',
    h1: 'MM-STUDIO',
    lead: 'MM-STUDIO by Maudite Machine · drum machine, synth and DJ decks in 3D',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-STUDIO by Maudite Machine is the home page of mauditemachine.com: a studio in 3D that you play in the browser. Three machines share one desk and play in time. It is free, with no account and nothing to install.',
          'Drag to turn the view, click a machine to bring it in front of you, or move between machines with the arrow keys.',
        ],
      },
      {
        h2: 'The machines',
        items: [
          '[MM-RYTM](/mm-studio/drum-machine/): a drum machine with eight voices (BD, SD, CH, OH, CP, TOM, HT, CY), 16 steps, parameter locks and 16 patterns.',
          '[MM-ARP](/mm-studio/synth/): a synth with two oscillators and a sub, a ladder filter, an arpeggiator and eight chord pads.',
          '[MM-DECKS](/mm-studio/dj-decks/): two to four DJ decks, a mixer that also takes the two machines, and a sampler in each deck.',
        ],
      },
      {
        h2: 'How to play',
        ordered: true,
        items: [
          'Open mauditemachine.com on a computer or a phone, or go straight to a machine with a link such as mauditemachine.com/?m=rytm.',
          'On MM-RYTM, choose a voice, tap the steps, then press RUN/STOP or the space bar.',
          'Add chords on MM-ARP. It follows the tempo of the drums.',
          'Load a track on MM-DECKS and mix it over the machines.',
        ],
      },
      {
        h2: 'MIDI and Roto-Control',
        paragraphs: [
          'Every parameter and action of the machines can be assigned to a MIDI controller with MIDI LEARN (Web MIDI: Chrome, Edge, Opera and Firefox on a computer, not Safari). For a Melbourne Instruments Roto-Control, the MIDI panel has ready-made setups to download and import in ROTO-SETUP: no MIDI LEARN needed, each page has its short names and its colour, and the motorised knobs follow the screen.',
        ],
      },
      {
        h2: 'Presets, undo and settings',
        paragraphs: [
          'SAVE keeps the state of MM-RYTM or MM-ARP as a preset in your browser. UNDO, in the header, steps back through your changes (Cmd+Z or Ctrl+Z) and REDO steps forward. The menu switches between Dark and Light.',
        ],
      },
      {
        h2: 'Browsers, phones and accessibility',
        paragraphs: [
          'MM-STUDIO needs WebGL 2 and the Web Audio API (current Chrome, Edge, Firefox and Safari). On a phone, each machine has its own portrait layout. Without WebGL 2, the site opens a plain HTML version. Each control of the 3D machines has a named HTML twin for the keyboard and screen readers.',
        ],
      },
      {
        h2: 'Who made it',
        paragraphs: [
          'MM-STUDIO was designed and built by Mika, who records and plays as Maudite Machine: a DJ and producer based in Montpellier, in the south of France, after fifteen years in the Montréal underground. He plays indie dance and dark disco with a psychedelic edge and runs the label VRSTL Records.',
        ],
        items: ['[Press assets](/press/)', '[Contact and booking](/contact/)'],
      },
      {
        h2: 'Credits',
        items: ['Design and build: Mika (Maudite Machine)', '3D: Three.js, on WebGL 2', 'Sound: Web Audio API', 'Controllers: Web MIDI API'],
      },
    ],
    cta: { text: 'Open MM-STUDIO', href: `${SITE}/` },
    imageAlt: 'MM-STUDIO by Maudite Machine: MM-RYTM, MM-ARP and MM-DECKS side by side in 3D',
  },
  {
    cluster: 'hub',
    lang: 'fr',
    path: '/fr/mm-studio/',
    title: 'MM-STUDIO | Boîte à rythmes, synthé et platines DJ en ligne',
    description:
      'Un studio 3D à jouer dans le navigateur : boîte à rythmes MM-RYTM avec P-locks, synthé MM-ARP avec arpégiateur, platines MM-DECKS. Gratuit, compatible MIDI.',
    h1: 'MM-STUDIO',
    lead: 'MM-STUDIO by Maudite Machine · boîte à rythmes, synthé et platines DJ en 3D',
    sections: [
      {
        h2: null,
        paragraphs: [
          "MM-STUDIO by Maudite Machine est la page d'accueil de mauditemachine.com : un studio en 3D qui se joue dans le navigateur. Trois machines partagent la même table et jouent en rythme. C'est gratuit, sans compte et sans rien à installer.",
          "Faites glisser pour tourner la vue, cliquez sur une machine pour l'amener devant vous, ou passez de l'une à l'autre avec les flèches du clavier.",
        ],
      },
      {
        h2: 'Les machines',
        items: [
          '[MM-RYTM](/fr/mm-studio/boite-a-rythmes/) : une boîte à rythmes à huit voix (BD, SD, CH, OH, CP, TOM, HT, CY), 16 pas, des P-locks et 16 patterns.',
          "[MM-ARP](/fr/mm-studio/synthe/) : un synthé à deux oscillateurs et un sub, un filtre ladder, un arpégiateur et huit pads d'accords.",
          '[MM-DECKS](/fr/mm-studio/platines-dj/) : deux à quatre platines DJ, une table de mixage qui reçoit aussi les deux machines, et un sampler dans chaque platine.',
        ],
      },
      {
        h2: 'Comment jouer',
        ordered: true,
        items: [
          'Ouvrez mauditemachine.com sur un ordinateur ou un téléphone, ou allez droit à une machine avec un lien comme mauditemachine.com/?m=rytm.',
          "Sur MM-RYTM, choisissez une voix, touchez les pas, puis RUN/STOP ou la barre d'espace.",
          'Ajoutez des accords sur MM-ARP. Il suit le tempo de la batterie.',
          'Chargez un morceau sur MM-DECKS et mixez-le par-dessus les machines.',
        ],
      },
      {
        h2: 'MIDI et Roto-Control',
        paragraphs: [
          "Chaque paramètre et chaque action des machines s'assigne à un contrôleur MIDI avec MIDI LEARN (Web MIDI : Chrome, Edge, Opera et Firefox sur ordinateur, pas Safari). Pour un Roto-Control de Melbourne Instruments, le panneau MIDI propose des configurations prêtes à télécharger et à importer dans ROTO-SETUP : pas besoin de MIDI LEARN, chaque page a ses noms courts et sa couleur, et les potards motorisés suivent l'écran.",
        ],
      },
      {
        h2: 'Presets, UNDO et réglages',
        paragraphs: [
          "SAVE garde l'état de MM-RYTM ou de MM-ARP en preset dans votre navigateur. UNDO, dans l'en-tête, revient sur vos changements (Cmd+Z ou Ctrl+Z) et REDO les rétablit. Le menu passe de Dark à Light.",
        ],
      },
      {
        h2: 'Navigateurs, téléphone et accessibilité',
        paragraphs: [
          "MM-STUDIO demande WebGL 2 et la Web Audio API (Chrome, Edge, Firefox et Safari récents). Au téléphone, chaque machine a sa mise en page en portrait. Sans WebGL 2, le site ouvre une version HTML simple. Chaque commande des machines 3D a un jumeau HTML nommé, pour le clavier et les lecteurs d'écran.",
        ],
      },
      {
        h2: "Qui l'a fait",
        paragraphs: [
          "MM-STUDIO a été dessiné et construit par Mika, qui produit et joue sous le nom de Maudite Machine : DJ et producteur installé à Montpellier, dans le Sud de la France, après quinze ans dans l'underground montréalais. Il joue de l'indie dance et de la dark disco à tendance psychédélique et dirige le label VRSTL Records.",
        ],
        items: ['[Éléments presse](/press/)', '[Contact et booking](/contact/)'],
      },
      {
        h2: 'Crédits',
        items: ['Design et construction : Mika (Maudite Machine)', '3D : Three.js, sur WebGL 2', 'Son : Web Audio API', 'Contrôleurs : Web MIDI API'],
      },
    ],
    cta: { text: 'Ouvrir MM-STUDIO', href: `${SITE}/` },
    imageAlt: 'MM-STUDIO by Maudite Machine : MM-RYTM, MM-ARP et MM-DECKS côte à côte en 3D',
  },
  {
    cluster: 'hub',
    lang: 'es',
    path: '/es/mm-studio/',
    title: 'MM-STUDIO | Caja de ritmos, sintetizador y platos DJ online',
    description:
      'Un estudio 3D para tocar en el navegador: caja de ritmos MM-RYTM con P-locks, sintetizador MM-ARP con arpegiador y platos MM-DECKS. Gratis, compatible con MIDI.',
    h1: 'MM-STUDIO',
    lead: 'MM-STUDIO by Maudite Machine · caja de ritmos, sintetizador y platos DJ en 3D',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-STUDIO by Maudite Machine es la página de inicio de mauditemachine.com: un estudio en 3D que se toca en el navegador. Tres máquinas comparten la misma mesa y suenan a tempo. Es gratis, sin cuenta y sin nada que instalar.',
          'Arrastra para girar la vista, haz clic en una máquina para traerla delante o pasa de una a otra con las flechas del teclado.',
        ],
      },
      {
        h2: 'Las máquinas',
        items: [
          '[MM-RYTM](/es/mm-studio/caja-de-ritmos/): una caja de ritmos de ocho voces (BD, SD, CH, OH, CP, TOM, HT, CY), 16 pasos, P-locks y 16 patrones.',
          '[MM-ARP](/es/mm-studio/sintetizador/): un sintetizador con dos osciladores y un sub, un filtro ladder, un arpegiador y ocho pads de acordes.',
          '[MM-DECKS](/es/mm-studio/platos-dj/): de dos a cuatro platos DJ, una mesa de mezclas que también recibe las dos máquinas y un sampler en cada plato.',
        ],
      },
      {
        h2: 'Cómo tocar',
        ordered: true,
        items: [
          'Abre mauditemachine.com en un ordenador o un móvil, o ve directo a una máquina con un enlace como mauditemachine.com/?m=rytm.',
          'En MM-RYTM, elige una voz, toca los pasos y pulsa RUN/STOP o la barra espaciadora.',
          'Añade acordes en MM-ARP. Sigue el tempo de la batería.',
          'Carga un tema en MM-DECKS y mézclalo sobre las máquinas.',
        ],
      },
      {
        h2: 'MIDI y Roto-Control',
        paragraphs: [
          'Cada parámetro y cada acción de las máquinas se asigna a un controlador MIDI con MIDI LEARN (Web MIDI: Chrome, Edge, Opera y Firefox en ordenador, no Safari). Para un Roto-Control de Melbourne Instruments, el panel MIDI ofrece configuraciones listas para descargar e importar en ROTO-SETUP: no hace falta MIDI LEARN, cada página tiene sus nombres cortos y su color, y los potenciómetros motorizados siguen la pantalla.',
        ],
      },
      {
        h2: 'Presets, UNDO y ajustes',
        paragraphs: [
          'SAVE guarda el estado de MM-RYTM o de MM-ARP como preset en tu navegador. UNDO, en la cabecera, deshace tus cambios (Cmd+Z o Ctrl+Z) y REDO los rehace. El menú cambia entre Dark y Light.',
        ],
      },
      {
        h2: 'Navegadores, móvil y accesibilidad',
        paragraphs: [
          'MM-STUDIO necesita WebGL 2 y la Web Audio API (Chrome, Edge, Firefox y Safari recientes). En el móvil, cada máquina tiene su diseño en vertical. Sin WebGL 2, el sitio abre una versión HTML sencilla. Cada control de las máquinas 3D tiene un gemelo HTML con nombre para el teclado y los lectores de pantalla.',
        ],
      },
      {
        h2: 'Quién lo hizo',
        paragraphs: [
          'MM-STUDIO lo diseñó y construyó Mika, que produce y pincha como Maudite Machine: DJ y productor con base en Montpellier, en el sur de Francia, tras quince años en el underground de Montreal. Pincha indie dance y dark disco con un toque psicodélico y dirige el sello VRSTL Records.',
        ],
        items: ['[Material de prensa](/press/)', '[Contacto y booking](/contact/)'],
      },
      {
        h2: 'Créditos',
        items: ['Diseño y construcción: Mika (Maudite Machine)', '3D: Three.js, sobre WebGL 2', 'Sonido: Web Audio API', 'Controladores: Web MIDI API'],
      },
    ],
    cta: { text: 'Abrir MM-STUDIO', href: `${SITE}/` },
    imageAlt: 'MM-STUDIO by Maudite Machine: MM-RYTM, MM-ARP y MM-DECKS uno al lado del otro en 3D',
  },

  /* ---------- MM-RYTM ---------- */
  {
    cluster: 'rytm',
    lang: 'en',
    path: '/mm-studio/drum-machine/',
    title: 'Free Online Drum Machine with P-Locks | MM-RYTM',
    description:
      'MM-RYTM is a free drum machine in your browser: 8 voices, 16 steps, parameter locks, 16 patterns, a sample or synth layer per voice, effects and MIDI.',
    h1: 'MM-RYTM',
    lead: 'Drum machine · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-RYTM is the drum machine of MM-STUDIO by Maudite Machine, a free 3D studio that you play in the browser, with no account and nothing to install. It has eight voices on 16 steps, with parameter locks.',
        ],
      },
      {
        h2: 'Voices and sounds',
        paragraphs: [
          'The eight voices are BD, SD, CH, OH, CP, TOM, HT and CY. Each voice plays a SYNTH layer (909, 808 or MM models), a SAMPLE layer or both; the kick and snare samples were picked by Mika.',
        ],
      },
      {
        h2: 'Steps and parameter locks',
        paragraphs: [
          'Tap a step to write a hit, tap again for MID, LOW and off, or hold and drag to set its velocity. Hold a step until the screen reads P-LOCK, then drag a screen value: it plays on this step only, for sound, volume, pitch, filter, envelope or voice effects.',
        ],
      },
      {
        h2: 'Pages, effects and patterns',
        paragraphs: [
          'The screen has eight blocks, with values from 0 to 127, over four pages: VOICE, FLTR, ENV and FX. Each voice has its own DIST, CHORUS, DELAY and REVERB; the machine adds DIST, CHORUS, DELAY, REVERB, STRETCH, SWING, BIT and COMP, on the eight knobs under the screen on a computer. EDIT turns the steps into 16 patterns, A01 to A16, that you can chain. The tempo runs from 100 to 150 BPM.',
        ],
      },
      {
        h2: 'How to play',
        ordered: true,
        items: [
          'Open [MM-RYTM](https://mauditemachine.com/?m=rytm). On a phone it opens first.',
          'Pick a voice pad, or press A S D F and Z X C V.',
          'Tap the steps to write its part, then press RUN/STOP or the space bar.',
          'Hold a step to lock a value, then SAVE the preset.',
        ],
      },
      {
        h2: 'MIDI, browser and accessibility',
        paragraphs: [
          'Every knob, page, step and pad can be assigned with MIDI LEARN. The MIDI panel also has ready-made Roto-Control setups to import in ROTO-SETUP, with no MIDI LEARN needed. With its RSEQ setup imported, a Roto-Control doubles as a step sequencer: the steps scroll on its buttons, and holding one while turning a knob sets a lock.',
          'MM-RYTM needs WebGL 2 and the Web Audio API. Every pad, step and knob has a named HTML twin for the keyboard and screen readers, and UNDO covers every change.',
        ],
      },
      {
        h2: 'Who made it',
        paragraphs: [
          'Mika designed and built MM-RYTM and the rest of MM-STUDIO. As Maudite Machine, he is a DJ and producer based in Montpellier and the founder of VRSTL Records.',
        ],
        items: [
          '[MM-STUDIO overview](/mm-studio/)',
          '[MM-ARP synth](/mm-studio/synth/)',
          '[MM-DECKS DJ decks](/mm-studio/dj-decks/)',
          '[Press assets](/press/)',
          '[Contact](/contact/)',
        ],
      },
    ],
    cta: { text: 'Play MM-RYTM', href: `${SITE}/?m=rytm` },
    imageAlt: 'The MM-RYTM drum machine of MM-STUDIO by Maudite Machine, in 3D',
  },
  {
    cluster: 'rytm',
    lang: 'fr',
    path: '/fr/mm-studio/boite-a-rythmes/',
    title: 'Boîte à rythmes en ligne gratuite avec P-locks | MM-RYTM',
    description:
      'MM-RYTM, boîte à rythmes gratuite dans le navigateur : 8 voix, 16 pas, P-locks, 16 patterns, une couche sample ou synthé par voix, des effets et le MIDI.',
    h1: 'MM-RYTM',
    lead: 'Boîte à rythmes · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-RYTM est la boîte à rythmes de MM-STUDIO by Maudite Machine, un studio en 3D gratuit qui se joue dans le navigateur, sans compte ni installation. Elle a huit voix sur 16 pas, avec des P-locks.',
        ],
      },
      {
        h2: 'Voix et sons',
        paragraphs: [
          'Les huit voix sont BD, SD, CH, OH, CP, TOM, HT et CY. Chaque voix joue une couche SYNTH (modèles 909, 808 ou MM), une couche SAMPLE ou les deux ; Mika a choisi les samples de kick et de caisse claire.',
        ],
      },
      {
        h2: 'Pas et P-locks',
        paragraphs: [
          "Touchez un pas pour poser un coup, encore pour MID, LOW puis vide, ou tenez-le et glissez pour régler sa vélocité. Tenez un pas jusqu'à ce que l'écran affiche P-LOCK, puis glissez une valeur de l'écran : elle ne joue que sur ce pas, pour le son, le volume, la hauteur, le filtre, l'enveloppe ou les effets de la voix.",
        ],
      },
      {
        h2: 'Pages, effets et patterns',
        paragraphs: [
          "L'écran a huit blocs (valeurs de 0 à 127) sur quatre pages : VOICE, FLTR, ENV et FX. Chaque voix a ses DIST, CHORUS, DELAY et REVERB ; la machine ajoute DIST, CHORUS, DELAY, REVERB, STRETCH, SWING, BIT et COMP, sur huit potards à l'ordinateur. EDIT change les pas en 16 patterns, de A01 à A16, à enchaîner. Le tempo va de 100 à 150 BPM.",
        ],
      },
      {
        h2: 'Comment jouer',
        ordered: true,
        items: [
          "Ouvrez [MM-RYTM](https://mauditemachine.com/?m=rytm). Au téléphone, c'est la première machine.",
          'Choisissez un pad de voix, ou les touches A S D F et Z X C V.',
          "Touchez les pas pour écrire sa partie, puis RUN/STOP ou la barre d'espace.",
          'Tenez un pas pour verrouiller une valeur, puis SAVE pour garder le preset.',
        ],
      },
      {
        h2: 'MIDI, navigateur et accessibilité',
        paragraphs: [
          "Chaque potard, page, pas et pad s'assigne avec MIDI LEARN. Le panneau MIDI propose aussi des configurations Roto-Control prêtes à importer dans ROTO-SETUP, sans MIDI LEARN. Avec sa configuration RSEQ, un Roto-Control sert aussi de séquenceur : les pas défilent sur ses boutons, et tenir un bouton en tournant un potard pose un verrou.",
          "Il faut WebGL 2 et la Web Audio API. Chaque pad, pas et potard a un jumeau HTML nommé pour le clavier et les lecteurs d'écran ; UNDO défait chaque changement.",
        ],
      },
      {
        h2: "Qui l'a fait",
        paragraphs: [
          'Mika a dessiné et construit MM-RYTM et tout MM-STUDIO. Sous le nom de Maudite Machine, il est DJ et producteur à Montpellier et fondateur de VRSTL Records.',
        ],
        items: [
          "[MM-STUDIO, la vue d'ensemble](/fr/mm-studio/)",
          '[Synthé MM-ARP](/fr/mm-studio/synthe/)',
          '[Platines DJ MM-DECKS](/fr/mm-studio/platines-dj/)',
          '[Éléments presse](/press/)',
          '[Contact](/contact/)',
        ],
      },
    ],
    cta: { text: 'Jouer sur MM-RYTM', href: `${SITE}/?m=rytm` },
    imageAlt: 'La boîte à rythmes MM-RYTM de MM-STUDIO by Maudite Machine, en 3D',
  },
  {
    cluster: 'rytm',
    lang: 'es',
    path: '/es/mm-studio/caja-de-ritmos/',
    title: 'Caja de ritmos online gratis con P-locks | MM-RYTM',
    description:
      'MM-RYTM, caja de ritmos gratis en el navegador: 8 voces, 16 pasos, P-locks, 16 patrones, una capa de sample o de síntesis por voz, efectos y MIDI.',
    h1: 'MM-RYTM',
    lead: 'Caja de ritmos · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-RYTM es la caja de ritmos de MM-STUDIO by Maudite Machine, un estudio en 3D gratis que se toca en el navegador, sin cuenta ni instalación. Tiene ocho voces sobre 16 pasos, con P-locks.',
        ],
      },
      {
        h2: 'Voces y sonidos',
        paragraphs: [
          'Las ocho voces son BD, SD, CH, OH, CP, TOM, HT y CY. Cada voz toca una capa SYNTH (modelos 909, 808 o MM), una capa SAMPLE o las dos; los samples de bombo y de caja los eligió Mika.',
        ],
      },
      {
        h2: 'Pasos y P-locks',
        paragraphs: [
          'Toca un paso para escribir un golpe, otra vez para MID, LOW y apagado, o mantenlo y arrastra para ajustar su velocidad. Mantén un paso hasta que la pantalla muestre P-LOCK y arrastra un valor de la pantalla: solo suena en ese paso, para el sonido, el volumen, la afinación, el filtro, la envolvente o los efectos de la voz.',
        ],
      },
      {
        h2: 'Páginas, efectos y patrones',
        paragraphs: [
          'La pantalla tiene ocho bloques (valores de 0 a 127) en cuatro páginas: VOICE, FLTR, ENV y FX. Cada voz tiene sus DIST, CHORUS, DELAY y REVERB; la máquina añade DIST, CHORUS, DELAY, REVERB, STRETCH, SWING, BIT y COMP, en ocho potenciómetros en el ordenador. EDIT convierte los pasos en 16 patrones, de A01 a A16, que se pueden encadenar. El tempo va de 100 a 150 BPM.',
        ],
      },
      {
        h2: 'Cómo tocar',
        ordered: true,
        items: [
          'Abre [MM-RYTM](https://mauditemachine.com/?m=rytm). En el móvil es la primera máquina.',
          'Elige un pad de voz, o las teclas A S D F y Z X C V.',
          'Toca los pasos para escribir su parte y pulsa RUN/STOP o la barra espaciadora.',
          'Mantén un paso para bloquear un valor y guarda el preset con SAVE.',
        ],
      },
      {
        h2: 'MIDI, navegador y accesibilidad',
        paragraphs: [
          'Cada potenciómetro, página, paso y pad se asigna con MIDI LEARN. El panel MIDI también ofrece configuraciones de Roto-Control listas para importar en ROTO-SETUP, sin MIDI LEARN. Con su configuración RSEQ, un Roto-Control también sirve de secuenciador: los pasos pasan por sus botones, y mantener uno mientras giras un potenciómetro fija un bloqueo.',
          'Necesita WebGL 2 y la Web Audio API. Cada pad, paso y potenciómetro tiene un gemelo HTML con nombre para el teclado y los lectores de pantalla; UNDO deshace cada cambio.',
        ],
      },
      {
        h2: 'Quién lo hizo',
        paragraphs: [
          'Mika diseñó y construyó MM-RYTM y todo MM-STUDIO. Como Maudite Machine es DJ y productor en Montpellier y fundador de VRSTL Records.',
        ],
        items: [
          '[MM-STUDIO, vista general](/es/mm-studio/)',
          '[Sintetizador MM-ARP](/es/mm-studio/sintetizador/)',
          '[Platos DJ MM-DECKS](/es/mm-studio/platos-dj/)',
          '[Material de prensa](/press/)',
          '[Contacto](/contact/)',
        ],
      },
    ],
    cta: { text: 'Tocar MM-RYTM', href: `${SITE}/?m=rytm` },
    imageAlt: 'La caja de ritmos MM-RYTM de MM-STUDIO by Maudite Machine, en 3D',
  },

  /* ---------- MM-ARP ---------- */
  {
    cluster: 'arp',
    lang: 'en',
    path: '/mm-studio/synth/',
    title: 'Free Online Synth with Arpeggiator | MM-ARP',
    description:
      'MM-ARP is a free synth in your browser: two oscillators and a sub, a ladder filter, an arpeggiator, eight chord pads in F# minor, effects and MIDI.',
    h1: 'MM-ARP',
    lead: 'Synth and arpeggiator · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-ARP is the synth of MM-STUDIO by Maudite Machine, a free 3D studio that you play in the browser, with no account and nothing to install. You build a chord progression on eight pads and the arpeggiator plays it in time with MM-RYTM.',
        ],
      },
      {
        h2: 'Chords and arpeggiator',
        paragraphs: [
          'The eight pads hold eight chords in F# minor (F#m, D, E, C#m, Bm, A, F#m7, Dmaj7), so every note stays in the key. Each pad you tap adds a bar to the progression; tap it again to remove it. RATE runs from 1/4 to 1/32, MODE plays UP, DOWN, UP/DN or RAND, and RANGE covers one to three octaves. EDIT opens a screen to draw your own notes.',
        ],
      },
      {
        h2: 'Sound',
        paragraphs: [
          'Two oscillators morph from sine to triangle, saw, square and pulse, with a sub one or two octaves below and FM on the first oscillator. The filter has four modes (24 dB ladder low pass, 12 dB low pass, band pass, high pass) and its own envelope. An amp envelope, a tempo synced LFO and OVERDRIVE, CHORUS, DELAY and REVERB complete the voice.',
        ],
      },
      {
        h2: 'Under the hood',
        paragraphs: [
          'OPEN lifts the cover on the TWEAKS (PHASE, DRIFT, WIDTH, BASS MONO, KEY TRACK, ACCENT, SYNC, SIDECHAIN, CHORD) and SCOPE, an oscilloscope. SIDECHAIN ducks the synth under each MM-RYTM kick; CHORD turns the arpeggio into chained chords, from triads to elevenths.',
        ],
      },
      {
        h2: 'How to play',
        ordered: true,
        items: [
          'Open [MM-ARP](https://mauditemachine.com/?m=arp).',
          'Tap a few chord pads, or press A S D F G H J K.',
          'Press RUN/STOP or the space bar; MM-RYTM can play along.',
          'Turn CUTOFF and RES while it plays, then SAVE the preset.',
        ],
      },
      {
        h2: 'MIDI, browsers and accessibility',
        paragraphs: [
          'Every control can be assigned with MIDI LEARN. The ready-made Roto-Control setup, downloaded from the MIDI panel and imported in ROTO-SETUP, puts the chords on its buttons with no MIDI LEARN. MM-ARP needs WebGL 2 and the Web Audio API; Web MIDI works in Chrome, Edge, Opera and Firefox. Each knob and pad has a named HTML twin for the keyboard and screen readers.',
        ],
      },
      {
        h2: 'Who made it',
        paragraphs: [
          'Mika designed and built MM-ARP and the rest of MM-STUDIO. As Maudite Machine, he is a DJ and producer based in Montpellier and runs VRSTL Records.',
        ],
        items: [
          '[MM-STUDIO overview](/mm-studio/)',
          '[MM-RYTM drum machine](/mm-studio/drum-machine/)',
          '[MM-DECKS DJ decks](/mm-studio/dj-decks/)',
          '[Press assets](/press/)',
          '[Contact](/contact/)',
        ],
      },
    ],
    cta: { text: 'Play MM-ARP', href: `${SITE}/?m=arp` },
    imageAlt: 'The MM-ARP synth of MM-STUDIO by Maudite Machine, in 3D',
  },
  {
    cluster: 'arp',
    lang: 'fr',
    path: '/fr/mm-studio/synthe/',
    title: 'Synthé en ligne gratuit avec arpégiateur | MM-ARP',
    description:
      "MM-ARP, synthé gratuit dans le navigateur : deux oscillateurs et un sub, filtre ladder, arpégiateur, huit pads d'accords en fa dièse mineur, effets et MIDI.",
    h1: 'MM-ARP',
    lead: 'Synthé et arpégiateur · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          "MM-ARP est le synthé de MM-STUDIO by Maudite Machine, un studio en 3D gratuit qui se joue dans le navigateur, sans compte ni installation. On construit une suite d'accords sur huit pads et l'arpégiateur la joue en rythme avec MM-RYTM.",
        ],
      },
      {
        h2: 'Accords et arpégiateur',
        paragraphs: [
          "Les huit pads portent huit accords de fa dièse mineur (F#m, D, E, C#m, Bm, A, F#m7, Dmaj7) : chaque note reste dans la tonalité. Chaque pad touché ajoute une mesure à la progression ; touché de nouveau, il en sort. RATE va de 1/4 à 1/32, MODE joue UP, DOWN, UP/DN ou RAND, et RANGE couvre une à trois octaves. EDIT ouvre un écran pour dessiner ses propres notes.",
        ],
      },
      {
        h2: 'Le son',
        paragraphs: [
          "Deux oscillateurs passent du sinus au triangle, à la dent de scie, au carré et à l'impulsion, avec un sub une ou deux octaves plus bas et de la FM sur le premier oscillateur. Le filtre a quatre modes (passe-bas ladder 24 dB, passe-bas 12 dB, passe-bande, passe-haut) et sa propre enveloppe. Une enveloppe de volume, un LFO calé sur le tempo et OVERDRIVE, CHORUS, DELAY et REVERB complètent la voix.",
        ],
      },
      {
        h2: 'Sous le capot',
        paragraphs: [
          "OPEN soulève le capot sur les TWEAKS (PHASE, DRIFT, WIDTH, BASS MONO, KEY TRACK, ACCENT, SYNC, SIDECHAIN, CHORD) et SCOPE, un oscilloscope. SIDECHAIN fait baisser le synthé sous chaque kick de MM-RYTM ; CHORD change l'arpège en accords enchaînés, de la triade à la onzième.",
        ],
      },
      {
        h2: 'Comment jouer',
        ordered: true,
        items: [
          'Ouvrez [MM-ARP](https://mauditemachine.com/?m=arp).',
          "Touchez quelques pads d'accords, ou les touches A S D F G H J K.",
          "RUN/STOP ou la barre d'espace lance l'arpège ; MM-RYTM peut jouer avec.",
          'Tournez CUTOFF et RES pendant que ça joue, puis SAVE pour garder le preset.',
        ],
      },
      {
        h2: 'MIDI, navigateurs et accessibilité',
        paragraphs: [
          "Chaque commande s'assigne avec MIDI LEARN. La configuration Roto-Control, à télécharger dans le panneau MIDI et à importer dans ROTO-SETUP, met les accords sur ses boutons, sans MIDI LEARN. MM-ARP demande WebGL 2 et la Web Audio API ; le Web MIDI fonctionne dans Chrome, Edge, Opera et Firefox. Chaque potard et chaque pad a un jumeau HTML nommé, pour le clavier et les lecteurs d'écran.",
        ],
      },
      {
        h2: "Qui l'a fait",
        paragraphs: [
          'Mika a dessiné et construit MM-ARP et le reste de MM-STUDIO. Sous le nom de Maudite Machine, il est DJ et producteur, installé à Montpellier, et dirige VRSTL Records.',
        ],
        items: [
          "[MM-STUDIO, la vue d'ensemble](/fr/mm-studio/)",
          '[Boîte à rythmes MM-RYTM](/fr/mm-studio/boite-a-rythmes/)',
          '[Platines DJ MM-DECKS](/fr/mm-studio/platines-dj/)',
          '[Éléments presse](/press/)',
          '[Contact](/contact/)',
        ],
      },
    ],
    cta: { text: 'Jouer sur MM-ARP', href: `${SITE}/?m=arp` },
    imageAlt: 'Le synthé MM-ARP de MM-STUDIO by Maudite Machine, en 3D',
  },
  {
    cluster: 'arp',
    lang: 'es',
    path: '/es/mm-studio/sintetizador/',
    title: 'Sintetizador online gratis con arpegiador | MM-ARP',
    description:
      'MM-ARP, sintetizador gratis en el navegador: dos osciladores y un sub, filtro ladder, arpegiador, ocho pads de acordes en fa sostenido menor, efectos y MIDI.',
    h1: 'MM-ARP',
    lead: 'Sintetizador y arpegiador · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-ARP es el sintetizador de MM-STUDIO by Maudite Machine, un estudio en 3D gratis que se toca en el navegador, sin cuenta ni instalación. Construyes una progresión de acordes en ocho pads y el arpegiador la toca a tempo con MM-RYTM.',
        ],
      },
      {
        h2: 'Acordes y arpegiador',
        paragraphs: [
          'Los ocho pads llevan ocho acordes de fa sostenido menor (F#m, D, E, C#m, Bm, A, F#m7, Dmaj7), así que cada nota queda en la tonalidad. Cada pad que tocas añade un compás a la progresión; si lo tocas otra vez, sale. RATE va de 1/4 a 1/32, MODE toca UP, DOWN, UP/DN o RAND, y RANGE cubre de una a tres octavas. EDIT abre una pantalla para dibujar tus propias notas.',
        ],
      },
      {
        h2: 'El sonido',
        paragraphs: [
          'Dos osciladores pasan de la onda senoidal a la triangular, la de sierra, la cuadrada y la de pulso, con un sub una o dos octavas por debajo y FM en el primer oscilador. El filtro tiene cuatro modos (paso bajo ladder de 24 dB, paso bajo de 12 dB, paso banda, paso alto) y su propia envolvente. Una envolvente de volumen, un LFO sincronizado con el tempo y OVERDRIVE, CHORUS, DELAY y REVERB completan la voz.',
        ],
      },
      {
        h2: 'Bajo la tapa',
        paragraphs: [
          'OPEN levanta la tapa sobre los TWEAKS (PHASE, DRIFT, WIDTH, BASS MONO, KEY TRACK, ACCENT, SYNC, SIDECHAIN, CHORD) y SCOPE, un osciloscopio. SIDECHAIN baja el sintetizador bajo cada bombo de MM-RYTM; CHORD convierte el arpegio en acordes encadenados, de la tríada a la oncena.',
        ],
      },
      {
        h2: 'Cómo tocar',
        ordered: true,
        items: [
          'Abre [MM-ARP](https://mauditemachine.com/?m=arp).',
          'Toca algunos pads de acordes, o las teclas A S D F G H J K.',
          'Pulsa RUN/STOP o la barra espaciadora; MM-RYTM puede sonar con él.',
          'Gira CUTOFF y RES mientras suena y guarda el preset con SAVE.',
        ],
      },
      {
        h2: 'MIDI, navegadores y accesibilidad',
        paragraphs: [
          'Cada control se asigna con MIDI LEARN. La configuración de Roto-Control, que se descarga en el panel MIDI y se importa en ROTO-SETUP, pone los acordes en sus botones, sin MIDI LEARN. MM-ARP necesita WebGL 2 y la Web Audio API; Web MIDI funciona en Chrome, Edge, Opera y Firefox. Cada potenciómetro y cada pad tiene un gemelo HTML con nombre para el teclado y los lectores de pantalla.',
        ],
      },
      {
        h2: 'Quién lo hizo',
        paragraphs: [
          'Mika diseñó y construyó MM-ARP y el resto de MM-STUDIO. Como Maudite Machine es DJ y productor, con base en Montpellier, y dirige VRSTL Records.',
        ],
        items: [
          '[MM-STUDIO, vista general](/es/mm-studio/)',
          '[Caja de ritmos MM-RYTM](/es/mm-studio/caja-de-ritmos/)',
          '[Platos DJ MM-DECKS](/es/mm-studio/platos-dj/)',
          '[Material de prensa](/press/)',
          '[Contacto](/contact/)',
        ],
      },
    ],
    cta: { text: 'Tocar MM-ARP', href: `${SITE}/?m=arp` },
    imageAlt: 'El sintetizador MM-ARP de MM-STUDIO by Maudite Machine, en 3D',
  },

  /* ---------- MM-DECKS ---------- */
  {
    cluster: 'decks',
    lang: 'en',
    path: '/mm-studio/dj-decks/',
    title: 'Free Online DJ Mixer, 2 to 4 Decks | MM-DECKS',
    description:
      'MM-DECKS: free DJ decks and mixer in your browser. Mix Maudite Machine tracks, SoundCloud or your own files, with sync, loops, EQ and a sampler in each deck.',
    h1: 'MM-DECKS',
    lead: 'DJ decks and mixer · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-DECKS is the DJ setup of MM-STUDIO by Maudite Machine, a free 3D studio that you play in the browser, with no account and nothing to install. Two decks and a mixer sit next to the drum machine and the synth; ADD DECK takes you up to four.',
        ],
      },
      {
        h2: 'Tracks',
        paragraphs: [
          "Each deck screen has a track browser. MAUDITE lists tracks from Mika's SoundCloud that anyone can mix. SOUNDCLOUD finds Creative Commons tracks that allow remixing. MY SC connects your SoundCloud account to mix your own public tracks. FILES plays files from your device, kept between visits and never uploaded. PLAYLISTS keeps your own lists.",
        ],
      },
      {
        h2: 'Decks and mixer',
        paragraphs: [
          'Every deck has CUE, PLAY, loops, a pitch you can set to 0.05 BPM, and SYNC. Playing decks follow the tempo of the machines. The mixer takes MM-RYTM and MM-ARP on its first two channels, then one channel per deck, each with GAIN from -12 to +12 dB, a three band EQ (HI, MID, LOW), a filter, effects and VU meters.',
        ],
      },
      {
        h2: 'A sampler in each deck',
        paragraphs: [
          'REC DECK records the last beats of a deck, or its loop, and REC MIX the last beats of the mixer. SMPL shows the recording on the deck screen: slices on pads, grain clouds, a 16 step sequence, and SAVE to keep it as a WAV file.',
        ],
      },
      {
        h2: 'How to play',
        ordered: true,
        items: [
          'Open [MM-DECKS](https://mauditemachine.com/?m=decks).',
          'Pick a track in the screen of deck A, then another one in deck B.',
          'Press PLAY on A, then SYNC and PLAY on B.',
          'Start MM-RYTM or MM-ARP: they join the mix on channels 1 and 2.',
        ],
      },
      {
        h2: 'MIDI, browsers and accessibility',
        paragraphs: [
          'The decks and the mixer can be assigned with MIDI LEARN, and the MIDI panel has two ready-made Roto-Control setups to import in ROTO-SETUP, one for the decks and one for the mixer. MM-DECKS needs WebGL 2 and the Web Audio API; Web MIDI works in Chrome, Edge, Opera and Firefox. Each control has a named HTML twin for the keyboard and screen readers.',
        ],
      },
      {
        h2: 'Who made it',
        paragraphs: [
          'Mika designed and built MM-DECKS and the rest of MM-STUDIO. As Maudite Machine, he is a DJ and producer based in Montpellier, playing DJ sets on CDJs or hybrid live sets, and runs VRSTL Records.',
        ],
        items: [
          '[MM-STUDIO overview](/mm-studio/)',
          '[MM-RYTM drum machine](/mm-studio/drum-machine/)',
          '[MM-ARP synth](/mm-studio/synth/)',
          '[Press assets](/press/)',
          '[Contact](/contact/)',
        ],
      },
    ],
    cta: { text: 'Play MM-DECKS', href: `${SITE}/?m=decks` },
    imageAlt: 'The MM-DECKS DJ decks and mixer of MM-STUDIO by Maudite Machine, in 3D',
  },
  {
    cluster: 'decks',
    lang: 'fr',
    path: '/fr/mm-studio/platines-dj/',
    title: 'Platines DJ et table de mixage en ligne gratuites | MM-DECKS',
    description:
      'MM-DECKS, platines DJ et table de mixage gratuites dans le navigateur : mixez Maudite Machine, SoundCloud ou vos fichiers, avec sync, boucles, EQ et sampler.',
    h1: 'MM-DECKS',
    lead: 'Platines DJ et table de mixage · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          "MM-DECKS est le poste DJ de MM-STUDIO by Maudite Machine, un studio en 3D gratuit qui se joue dans le navigateur, sans compte ni installation. Deux platines et une table de mixage sont posées à côté de la boîte à rythmes et du synthé ; ADD DECK monte jusqu'à quatre.",
        ],
      },
      {
        h2: 'Les morceaux',
        paragraphs: [
          "L'écran de chaque platine a sa liste de morceaux. MAUDITE donne les morceaux du SoundCloud de Mika, que tout le monde peut mixer. SOUNDCLOUD trouve des morceaux Creative Commons qui autorisent le remix. MY SC connecte votre compte SoundCloud pour mixer vos morceaux publics. FILES joue les fichiers de votre appareil, gardés d'une visite à l'autre, jamais envoyés. PLAYLISTS garde vos listes.",
        ],
      },
      {
        h2: 'Platines et table de mixage',
        paragraphs: [
          'Chaque platine a CUE, PLAY, des boucles, un pitch réglable au 0,05 BPM et SYNC. Les platines qui jouent suivent le tempo des machines. La table reçoit MM-RYTM et MM-ARP sur ses deux premières voies, puis une voie par platine, chacune avec un GAIN de -12 à +12 dB, un EQ trois bandes, un filtre, des effets et des vumètres.',
        ],
      },
      {
        h2: 'Un sampler dans chaque platine',
        paragraphs: [
          "REC DECK enregistre les derniers temps d'une platine, ou sa boucle, et REC MIX les derniers temps de la table. SMPL l'affiche sur l'écran de la platine : tranches sur les pads, nuages de grains, séquence de 16 pas, et SAVE pour le garder en WAV.",
        ],
      },
      {
        h2: 'Comment jouer',
        ordered: true,
        items: [
          'Ouvrez [MM-DECKS](https://mauditemachine.com/?m=decks).',
          'Choisissez un morceau sur la platine A, puis un autre sur la B.',
          'PLAY sur A, puis SYNC et PLAY sur B.',
          'Lancez MM-RYTM ou MM-ARP : ils rejoignent le mix sur les voies 1 et 2.',
        ],
      },
      {
        h2: 'MIDI, navigateurs et accessibilité',
        paragraphs: [
          "Les platines et la table s'assignent avec MIDI LEARN, et le panneau MIDI propose deux configurations Roto-Control à importer dans ROTO-SETUP, une pour les platines et une pour la table. MM-DECKS demande WebGL 2 et la Web Audio API ; le Web MIDI fonctionne dans Chrome, Edge, Opera et Firefox. Chaque commande a un jumeau HTML nommé, pour le clavier et les lecteurs d'écran.",
        ],
      },
      {
        h2: "Qui l'a fait",
        paragraphs: [
          'Mika a dessiné et construit MM-DECKS et tout MM-STUDIO. Sous le nom de Maudite Machine, il est DJ et producteur à Montpellier, en DJ set sur CDJ ou en live hybride, et dirige VRSTL Records.',
        ],
        items: [
          "[MM-STUDIO, la vue d'ensemble](/fr/mm-studio/)",
          '[Boîte à rythmes MM-RYTM](/fr/mm-studio/boite-a-rythmes/)',
          '[Synthé MM-ARP](/fr/mm-studio/synthe/)',
          '[Éléments presse](/press/)',
          '[Contact](/contact/)',
        ],
      },
    ],
    cta: { text: 'Jouer sur MM-DECKS', href: `${SITE}/?m=decks` },
    imageAlt: 'Les platines DJ et la table de mixage MM-DECKS de MM-STUDIO by Maudite Machine, en 3D',
  },
  {
    cluster: 'decks',
    lang: 'es',
    path: '/es/mm-studio/platos-dj/',
    title: 'Platos DJ y mesa de mezclas online gratis | MM-DECKS',
    description:
      'MM-DECKS, platos DJ y mesa de mezclas gratis en el navegador: mezcla temas de Maudite Machine, SoundCloud o tus archivos, con sync, loops, EQ y sampler.',
    h1: 'MM-DECKS',
    lead: 'Platos DJ y mesa de mezclas · MM-STUDIO by Maudite Machine',
    sections: [
      {
        h2: null,
        paragraphs: [
          'MM-DECKS es el puesto de DJ de MM-STUDIO by Maudite Machine, un estudio en 3D gratis que se toca en el navegador, sin cuenta ni instalación. Dos platos y una mesa de mezclas están junto a la caja de ritmos y el sintetizador; ADD DECK llega hasta cuatro.',
        ],
      },
      {
        h2: 'Los temas',
        paragraphs: [
          'La pantalla de cada plato tiene su lista de temas. MAUDITE muestra los temas del SoundCloud de Mika, que cualquiera puede mezclar. SOUNDCLOUD encuentra temas Creative Commons que permiten el remix. MY SC conecta tu cuenta de SoundCloud para mezclar tus temas públicos. FILES toca archivos de tu dispositivo, guardados entre visitas y nunca subidos. PLAYLISTS guarda tus listas.',
        ],
      },
      {
        h2: 'Platos y mesa de mezclas',
        paragraphs: [
          'Cada plato tiene CUE, PLAY, loops, un pitch ajustable a 0,05 BPM y SYNC. Los platos que suenan siguen el tempo de las máquinas. La mesa recibe MM-RYTM y MM-ARP en sus dos primeros canales y luego un canal por plato, cada uno con GAIN de -12 a +12 dB, un EQ de tres bandas (HI, MID, LOW), un filtro, efectos y vúmetros.',
        ],
      },
      {
        h2: 'Un sampler en cada plato',
        paragraphs: [
          'REC DECK graba los últimos tiempos de un plato, o su loop, y REC MIX los últimos tiempos de la mesa. SMPL la muestra en la pantalla del plato: slices en los pads, nubes de granos, secuencia de 16 pasos y SAVE para guardarla en WAV.',
        ],
      },
      {
        h2: 'Cómo tocar',
        ordered: true,
        items: [
          'Abre [MM-DECKS](https://mauditemachine.com/?m=decks).',
          'Elige un tema en el plato A y otro en el B.',
          'PLAY en A, luego SYNC y PLAY en B.',
          'Arranca MM-RYTM o MM-ARP: entran en la mezcla por los canales 1 y 2.',
        ],
      },
      {
        h2: 'MIDI, navegadores y accesibilidad',
        paragraphs: [
          'Los platos y la mesa se asignan con MIDI LEARN, y el panel MIDI ofrece dos configuraciones de Roto-Control para importar en ROTO-SETUP, una para los platos y otra para la mesa. MM-DECKS necesita WebGL 2 y la Web Audio API; Web MIDI funciona en Chrome, Edge, Opera y Firefox. Cada control tiene un gemelo HTML con nombre para el teclado y los lectores de pantalla.',
        ],
      },
      {
        h2: 'Quién lo hizo',
        paragraphs: [
          'Mika diseñó y construyó MM-DECKS y todo MM-STUDIO. Como Maudite Machine es DJ y productor en Montpellier, pincha en DJ set con CDJ o en live híbrido, y dirige VRSTL Records.',
        ],
        items: [
          '[MM-STUDIO, vista general](/es/mm-studio/)',
          '[Caja de ritmos MM-RYTM](/es/mm-studio/caja-de-ritmos/)',
          '[Sintetizador MM-ARP](/es/mm-studio/sintetizador/)',
          '[Material de prensa](/press/)',
          '[Contacto](/contact/)',
        ],
      },
    ],
    cta: { text: 'Tocar MM-DECKS', href: `${SITE}/?m=decks` },
    imageAlt: 'Los platos DJ y la mesa de mezclas MM-DECKS de MM-STUDIO by Maudite Machine, en 3D',
  },
];

/*
 * 2026-10-21 (audit SEO IMP7 et IMP9, Mika : "je veux vraiment que tu travailles sur un referencement plus que complet
 * ! je veux du monde dans mon site !") :
 * - une FAQ par page de machine, les vraies questions de quelqu'un qui arrive d'une recherche (gratuit, telephone,
 *   MIDI, ses propres sons, ou tout est garde, partage, export), chaque reponse relue dans le code ce jour-la
 *   (state/share.ts pour SHARE ; audio/usersamples.ts, les samples de ce navigateur jamais publies ; state/presets.ts,
 *   99 presets ; dj/SamplerScreen.tsx, l'export WAV ; dj/TrackBrowser.tsx, les sources ; aucun service worker : le
 *   site ne marche pas hors ligne, la FAQ ne le promet pas). Le prerender l'ecrit en HTML et en FAQPage (JSON-LD) ;
 * - le maillage entre l'outil et l'artiste : chaque page de machine mene aux pages de motifs, et aux morceaux de
 *   Maudite Machine ;
 * - les pages de motifs par style (scripts/mm-studio-patterns.mjs), ajoutees a la liste : le prerender et le sitemap
 *   les prennent comme les autres.
 */
const FAQ_TITLE = { en: 'Questions', fr: 'Questions fréquentes', es: 'Preguntas frecuentes' };

const SHARE_A = {
  en: 'Yes. Press SHARE in the header of MM-STUDIO: on a phone the share sheet opens, on a computer the link is copied. Whoever opens the link gets your beat on MM-RYTM, with its steps, velocities, tempo, sounds and effects. Parameter locks and the samples you loaded from your own files stay in your browser.',
  fr: "Oui. Appuie sur SHARE dans l'en-tête de MM-STUDIO : au téléphone, la feuille de partage s'ouvre ; sur un ordinateur, le lien est copié. Qui ouvre le lien retrouve ton beat sur MM-RYTM, avec ses pas, ses vélocités, son tempo, ses sons et ses effets. Les P-locks et les samples chargés depuis tes fichiers restent dans ton navigateur.",
  es: 'Sí. Pulsa SHARE en la cabecera de MM-STUDIO: en el móvil se abre el menú de compartir, en un ordenador se copia el enlace. Quien abra el enlace tendrá tu beat en MM-RYTM, con sus pasos, velocidades, tempo, sonidos y efectos. Los P-locks y los samples cargados desde tus archivos se quedan en tu navegador.',
};

const FAQ = {
  '/mm-studio/drum-machine/': [
    ['Is MM-RYTM free?', 'Yes. MM-RYTM is free, with no account, no download and no plug-in: it runs in your browser, on a computer or a phone.'],
    ['Can I share my beat?', SHARE_A.en],
    ['Does it work on an iPhone or an Android phone?', 'Yes. On a phone MM-RYTM has its own portrait layout, with the pads, the steps and the screen at finger size. MIDI controllers need Chrome, Edge, Opera or Firefox on a computer: Safari and iOS have no Web MIDI.'],
    ['Can I use my own samples?', 'Yes. Drop a WAV file on the sound list of the screen, or pick a file: the sample joins the list of its voice. It stays in this browser and is never uploaded.'],
    ['Where are my patterns saved?', 'In your browser. The pattern you are working on is kept between visits, SAVE keeps up to 99 presets per machine, and UNDO in the header steps back through your changes. Clearing the browser data erases them, so share a link to keep a copy.'],
    ['Can I export a WAV or a MIDI file?', 'MM-RYTM does not export audio itself. On a computer, the sampler of each MM-DECKS deck can record the MIXER, where MM-RYTM plays, and save the loop as a WAV file. Each [drum pattern page](/mm-studio/drum-patterns/) has a MIDI file of its style.'],
  ],
  '/fr/mm-studio/boite-a-rythmes/': [
    ['MM-RYTM est-il gratuit ?', "Oui. MM-RYTM est gratuit, sans compte, sans téléchargement ni plug-in : il tourne dans ton navigateur, sur un ordinateur ou un téléphone."],
    ['Je peux partager mon beat ?', SHARE_A.fr],
    ['Ça marche sur iPhone ou Android ?', "Oui. Au téléphone, MM-RYTM a sa propre disposition en hauteur, pads, pas et écran à la taille du doigt. Les contrôleurs MIDI demandent Chrome, Edge, Opera ou Firefox sur un ordinateur : Safari et iOS n'ont pas le Web MIDI."],
    ['Je peux utiliser mes propres samples ?', "Oui. Dépose un fichier WAV sur la liste des sons de l'écran, ou choisis un fichier : le sample rejoint la liste de sa voix. Il reste dans ce navigateur et n'est jamais envoyé en ligne."],
    ['Où sont gardés mes rythmes ?', "Dans ton navigateur. Le rythme en cours est gardé d'une visite à l'autre, SAVE garde jusqu'à 99 presets par machine et UNDO, dans l'en-tête, revient sur tes changements. Effacer les données du navigateur les efface : partage un lien pour en garder une copie."],
    ['Je peux exporter en WAV ou en MIDI ?', "MM-RYTM n'exporte pas l'audio lui-même. Sur un ordinateur, le sampler de chaque platine de MM-DECKS enregistre le MIXER, où joue MM-RYTM, et garde la boucle en fichier WAV. Chaque [page de rythme](/fr/mm-studio/rythmes/) a le fichier MIDI de son style."],
  ],
  '/es/mm-studio/caja-de-ritmos/': [
    ['¿MM-RYTM es gratis?', 'Sí. MM-RYTM es gratis, sin cuenta, sin descargas ni plug-ins: funciona en tu navegador, en un ordenador o en el móvil.'],
    ['¿Puedo compartir mi beat?', SHARE_A.es],
    ['¿Funciona en iPhone o Android?', 'Sí. En el móvil MM-RYTM tiene su propia disposición en vertical, con pads, pasos y pantalla al tamaño del dedo. Los controladores MIDI necesitan Chrome, Edge, Opera o Firefox en un ordenador: Safari e iOS no tienen Web MIDI.'],
    ['¿Puedo usar mis propios samples?', 'Sí. Suelta un archivo WAV sobre la lista de sonidos de la pantalla o elige un archivo: el sample se suma a la lista de su voz. Se queda en este navegador y nunca se sube.'],
    ['¿Dónde se guardan mis ritmos?', 'En tu navegador. El ritmo en curso se guarda entre visitas, SAVE guarda hasta 99 presets por máquina y UNDO, en la cabecera, deshace tus cambios. Borrar los datos del navegador los borra: comparte un enlace para guardar una copia.'],
    ['¿Puedo exportar en WAV o MIDI?', 'MM-RYTM no exporta audio por sí mismo. En un ordenador, el sampler de cada plato de MM-DECKS graba el MIXER, donde suena MM-RYTM, y guarda el bucle como archivo WAV. Cada [página de ritmo](/es/mm-studio/ritmos/) tiene el archivo MIDI de su estilo.'],
  ],
  '/mm-studio/synth/': [
    ['Is MM-ARP free?', 'Yes. MM-ARP is free, with no account and nothing to install: it runs in your browser, on a computer or a phone.'],
    ['Do I need to know music theory?', 'No. The eight chord pads are already in F# minor and the arpeggiator plays them in time: touch a pad and it plays.'],
    ['Does it follow the drum machine?', 'Yes. MM-ARP runs at the tempo of MM-STUDIO, and its SIDECHAIN ducks the synth on the kick of MM-RYTM.'],
    ['Can I use a MIDI controller?', 'Yes. Every knob and pad can be assigned with MIDI LEARN (Chrome, Edge, Opera or Firefox on a computer), and the MIDI panel has a ready-made Roto-Control setup.'],
    ['Where are my sounds saved?', 'In your browser. SAVE keeps the patch, the arpeggio and the chords as a preset (up to 99), and UNDO in the header steps back through your changes.'],
  ],
  '/fr/mm-studio/synthe/': [
    ['MM-ARP est-il gratuit ?', 'Oui. MM-ARP est gratuit, sans compte et sans rien à installer : il tourne dans ton navigateur, sur un ordinateur ou un téléphone.'],
    ['Il faut connaître le solfège ?', "Non. Les huit pads d'accords sont déjà en fa dièse mineur et l'arpégiateur les joue en rythme : tu touches un pad, il joue."],
    ['Il suit la boîte à rythmes ?', 'Oui. MM-ARP tourne au tempo de MM-STUDIO, et son SIDECHAIN fait respirer le synthé sur le kick de MM-RYTM.'],
    ['Je peux brancher un contrôleur MIDI ?', 'Oui. Chaque potard et chaque pad se règle avec MIDI LEARN (Chrome, Edge, Opera ou Firefox sur un ordinateur), et le panneau MIDI a un setup Roto-Control prêt.'],
    ['Où sont gardés mes sons ?', "Dans ton navigateur. SAVE garde le patch, l'arpège et les accords en preset (jusqu'à 99), et UNDO, dans l'en-tête, revient sur tes changements."],
  ],
  '/es/mm-studio/sintetizador/': [
    ['¿MM-ARP es gratis?', 'Sí. MM-ARP es gratis, sin cuenta y sin nada que instalar: funciona en tu navegador, en un ordenador o en el móvil.'],
    ['¿Hace falta saber teoría musical?', 'No. Los ocho pads de acordes ya están en fa sostenido menor y el arpegiador los toca a tempo: tocas un pad y suena.'],
    ['¿Sigue a la caja de ritmos?', 'Sí. MM-ARP va al tempo de MM-STUDIO y su SIDECHAIN hace respirar el sintetizador con el bombo de MM-RYTM.'],
    ['¿Puedo usar un controlador MIDI?', 'Sí. Cada potenciómetro y cada pad se asigna con MIDI LEARN (Chrome, Edge, Opera o Firefox en un ordenador), y el panel MIDI tiene un setup de Roto-Control listo.'],
    ['¿Dónde se guardan mis sonidos?', 'En tu navegador. SAVE guarda el patch, el arpegio y los acordes como preset (hasta 99), y UNDO, en la cabecera, deshace tus cambios.'],
  ],
  '/mm-studio/dj-decks/': [
    ['Is MM-DECKS free?', 'Yes. MM-DECKS is free, with no account and nothing to install: it runs in your browser.'],
    ['Which tracks can I play?', "Maudite Machine's own tracks (MAUDITE), SoundCloud tracks, your own SoundCloud (MY SC), your own audio files (FILES) and your playlists. Nothing you load from your computer is uploaded."],
    ['Does it sync with the drum machine and the synth?', 'Yes. MM-RYTM and MM-ARP come into the mixer, and the decks follow the tempo of the machines that play.'],
    ['Does it work on a phone?', 'On a phone held upright, MM-DECKS becomes MM-MIXER, the mixer of the machines, without the decks. The decks themselves are for a computer or a phone turned sideways.'],
    ['Can I record my mix?', 'Each deck has a sampler that can record its deck or the MIXER, slice the loop and save it as a WAV file.'],
  ],
  '/fr/mm-studio/platines-dj/': [
    ['MM-DECKS est-il gratuit ?', 'Oui. MM-DECKS est gratuit, sans compte et sans rien à installer : il tourne dans ton navigateur.'],
    ['Quels morceaux je peux jouer ?', "Les morceaux de Maudite Machine (MAUDITE), des morceaux SoundCloud, ton propre SoundCloud (MY SC), tes fichiers audio (FILES) et tes playlists. Rien de ce que tu charges depuis ton ordinateur n'est envoyé en ligne."],
    ['Il se cale sur la boîte à rythmes et le synthé ?', 'Oui. MM-RYTM et MM-ARP arrivent dans la table de mixage, et les platines suivent le tempo des machines qui jouent.'],
    ['Ça marche au téléphone ?', "Au téléphone tenu droit, MM-DECKS devient MM-MIXER, la table des machines, sans les platines. Les platines sont pour un ordinateur ou un téléphone tourné en largeur."],
    ['Je peux enregistrer mon mix ?', 'Chaque platine a un sampler qui enregistre sa platine ou le MIXER, découpe la boucle et la garde en fichier WAV.'],
  ],
  '/es/mm-studio/platos-dj/': [
    ['¿MM-DECKS es gratis?', 'Sí. MM-DECKS es gratis, sin cuenta y sin nada que instalar: funciona en tu navegador.'],
    ['¿Qué temas puedo pinchar?', 'Los temas de Maudite Machine (MAUDITE), temas de SoundCloud, tu propio SoundCloud (MY SC), tus archivos de audio (FILES) y tus playlists. Nada de lo que cargas desde tu ordenador se sube.'],
    ['¿Se sincroniza con la caja de ritmos y el sintetizador?', 'Sí. MM-RYTM y MM-ARP entran en la mesa de mezclas y los platos siguen el tempo de las máquinas que suenan.'],
    ['¿Funciona en el móvil?', 'Con el móvil en vertical, MM-DECKS se vuelve MM-MIXER, la mesa de las máquinas, sin los platos. Los platos son para un ordenador o un móvil en horizontal.'],
    ['¿Puedo grabar mi mezcla?', 'Cada plato tiene un sampler que graba su plato o el MIXER, trocea el bucle y lo guarda como archivo WAV.'],
  ],
};

/** Les liens de chaque page de MM-STUDIO vers les pages de motifs et vers l'artiste (2026-10-21, IMP9). */
const BRIDGE = {
  en: ['[Drum patterns for 10 styles, with MIDI files](/mm-studio/drum-patterns/)', "[Listen to Maudite Machine's tracks](/tracks/)"],
  fr: ['[Rythmes de batterie pour 10 styles, avec fichiers MIDI](/fr/mm-studio/rythmes/)', '[Écouter les morceaux de Maudite Machine](/tracks/)'],
  es: ['[Ritmos de batería para 10 estilos, con archivos MIDI](/es/mm-studio/ritmos/)', '[Escuchar los temas de Maudite Machine](/tracks/)'],
};

for (const page of MM_STUDIO_PAGES) {
  const last = page.sections[page.sections.length - 1];
  const who = page.sections.find((x) => x.items?.some((i) => /\]\(\/(press|contact)\/\)/.test(i))) ?? last;
  who.items = [...(who.items ?? []), ...BRIDGE[page.lang]];
  const faq = FAQ[page.path];
  if (faq) page.sections.splice(page.sections.indexOf(who), 0, { h2: FAQ_TITLE[page.lang], faq });
}
MM_STUDIO_PAGES.push(...PATTERN_PAGES);

/** Les pages d'une meme famille (hub, rytm, arp, decks) : leurs hreflang. */
export const clusterOf = (cluster) => MM_STUDIO_PAGES.filter((p) => p.cluster === cluster);

/** La page anglaise d'une famille (x-default de ses hreflang). */
export const englishOf = (cluster) => MM_STUDIO_PAGES.find((p) => p.cluster === cluster && p.lang === 'en');
