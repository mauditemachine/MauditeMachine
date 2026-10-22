/**
 * mm-studio-patterns.mjs : les pages de motifs de batterie par style (2026-10-21, audit SEO IMP5, Mika : "je veux
 * vraiment que tu travailles sur un referencement plus que complet ! je veux du monde dans mon site !").
 *
 * Les dix styles d'usine du MM-RYTM (src/v4/state/factory.ts, RYTM : ACID, DARK DISCO, INDIE DANCE, MINIMAL, ROLLING,
 * TECHNO, HOUSE, ELECTRO, EBM, ITALO), ecrits a la main d'apres la construction de chaque style, deviennent une page
 * chacun, en anglais d'abord puis en francais et en espagnol : la grille (8 voix, 16 pas, la velocite de chaque pas),
 * pourquoi le motif marche, deux variations, comment le programmer sur n'importe quelle machine, un fichier MIDI ecrit
 * au build (General MIDI, le swing compris) et un lien qui ouvre le motif dans le MM-RYTM, avec son kit et ses effets
 * (?m=rytm&b=<code>, le meme code que le partage, src/v4/audio/beatcode.ts). La longue traine "dark disco drum
 * pattern", "italo disco drum pattern", "ebm drum pattern"... est mal servie : aucune page concurrente ne donne a la
 * fois la grille, le MIDI et un motif jouable.
 *
 * Les pas, le tempo, le swing et les sons sont lus dans factory.ts au build (le meme texte que la machine joue : un
 * preset d'usine change, sa page suit) ; une forme inattendue rend une liste vide, jamais une erreur de build. Les
 * textes, eux, sont ecrits ici et relus contre les pas le 2026-10-21 (les numeros de pas cites viennent des grilles) :
 * un preset d'usine reecrit demande de relire son texte (pattern-check, plus bas, le signale au build).
 *
 * Adresses : /mm-studio/drum-patterns/ (le hub) et /mm-studio/drum-patterns/<style>/ ; /fr/mm-studio/rythmes/... ;
 * /es/mm-studio/ritmos/... Les pages entrent dans MM_STUDIO_PAGES (scripts/mm-studio-content.mjs) : le prerender les
 * ecrit, le sitemap les liste avec leurs hreflang. Jamais ici : la machine cachee (?bass=1).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://mauditemachine.com';

/* ---------------- le code des liens (le meme module que la machine) ---------------- */

/**
 * src/v4/audio/beatcode.ts, compile par esbuild (installe avec vite) en CommonJS et evalue sur place : aucun fichier
 * ecrit, aucune copie du code a tenir a jour. Sans esbuild : pas de lien jouable (la page garde le reste).
 */
function loadCodec() {
  try {
    const require = createRequire(import.meta.url);
    const { buildSync } = require('esbuild');
    const out = buildSync({ entryPoints: [join(ROOT, 'src/v4/audio/beatcode.ts')], bundle: true, format: 'cjs', write: false, platform: 'neutral', logLevel: 'silent' });
    const mod = { exports: {} };
    new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports);
    return typeof mod.exports.encodeBeat === 'function' ? mod.exports : null;
  } catch {
    return null;
  }
}
export const CODEC = loadCodec();

/* ---------------- les styles d'usine (factory.ts lu comme du texte) ---------------- */

const INSTS = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];

/**
 * Le tableau RYTM de factory.ts, evalue comme un litteral JavaScript (ses seules references : KICK.x, SNARE.x et
 * st(n), remplaces par des valeurs). Rend [] si la forme change.
 */
function loadRytm() {
  try {
    const src = readFileSync(join(ROOT, 'src/v4/state/factory.ts'), 'utf8');
    const start = src.indexOf('const RYTM: readonly RytmGenre[] = [');
    const stop = src.indexOf('export interface RytmFactory');
    if (start < 0 || stop < 0) return [];
    const open = src.indexOf('[', src.indexOf('=', start));
    const close = src.lastIndexOf('];', stop);
    const keys = (block) => Object.fromEntries([...block.matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
    const KICK = keys(src.match(/const KICK = \{([\s\S]*?)\} as const;/)?.[1] ?? '');
    const SNARE = keys(src.match(/const SNARE = \{([\s\S]*?)\} as const;/)?.[1] ?? '');
    const list = new Function('KICK', 'SNARE', 'st', `return ${src.slice(open, close + 1)};`)(KICK, SNARE, (n) => 0.5 + n / 24);
    if (!Array.isArray(list)) return [];
    return list
      .map((g, i) => ({ ...g, index: i + 1, steps: Object.fromEntries(INSTS.map((k) => [k, /^[0-9]{16}$/.test(g.steps?.[k] ?? '') ? g.steps[k] : '0'.repeat(16)])) }))
      .filter((g) => typeof g.name === 'string' && Number.isInteger(g.bpm));
  } catch {
    return [];
  }
}
const RYTM = loadRytm();

/** Le swing affiche par la machine (src/v4/theme.ts swingRatio : 50 % au neutre, un tiers de pas a fond). */
const swingPct = (v) => Math.round(50 * (1 + (Number(v) || 0) / 3));

/** Le nom court d'un sample (comme la machine : sans numero ni extension) : 'bd/05 Stein.wav' -> 'Stein'. */
const sampleName = (key) =>
  String(key ?? '')
    .split('/')
    .pop()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^\d+\s*/, '')
    .trim();

/* ---------------- les textes (ecrits a la main, relus contre les grilles) ---------------- */

/*
 * Chaque style : slug (l'adresse), factory (son nom dans factory.ts), name (le nom du style dans chaque langue),
 * intro, why (pourquoi le motif marche, ses pas cites), variations (deux), song (un morceau de Maudite Machine du
 * style, s'il y en a un) et check (des pas que le texte cite : le build verifie qu'ils jouent encore).
 * {swing} et {bpm} sont remplaces par les valeurs du preset.
 */
const GENRES = [
  {
    slug: 'acid-house',
    factory: 'ACID',
    name: { en: 'Acid house', fr: 'acid house', es: 'acid house' },
    check: { SD: [14, 16], OH: [3, 7, 11, 15], CP: [5, 13] },
    intro: {
      en: 'Acid house came out of Chicago in the late 1980s, when producers ran a TB-303 bass line over a drum machine. The drums stay simple on purpose: they leave room for the squelch of the bass.',
      fr: "L'acid house est née à Chicago à la fin des années 1980, quand des producteurs ont posé une ligne de TB-303 sur une boîte à rythmes. La batterie reste simple exprès : elle laisse la place au couinement de la basse.",
      es: 'El acid house nació en Chicago a finales de los años 80, cuando los productores pusieron una línea de TB-303 sobre una caja de ritmos. La batería es simple a propósito: deja sitio al chirrido del bajo.',
    },
    why: {
      en: 'The kick lands on every beat and the clap doubles the backbeat on 2 and 4. The closed hat plays all sixteen steps with an accent just before each beat (7, 4, 0, 8), the open hat sits on every off-beat, and two ghost snares on steps 14 and 16 pull the loop back to the top. {swing}% swing and a short reverb on the clap keep it raw.',
      fr: "Le kick tombe sur chaque temps et le clap double le contretemps sur 2 et 4. Le charley fermé joue les seize pas avec un accent juste avant chaque temps (7, 4, 0, 8), le charley ouvert se pose sur chaque contretemps, et deux caisses claires fantômes aux pas 14 et 16 ramènent la boucle au début. {swing} % de swing et une reverb courte sur le clap la gardent brute.",
      es: 'El bombo cae en cada tiempo y la palmada dobla el contratiempo en el 2 y el 4. El charles cerrado toca los dieciséis pasos con un acento justo antes de cada tiempo (7, 4, 0, 8), el abierto va en cada contratiempo y dos cajas fantasma en los pasos 14 y 16 devuelven el bucle al principio. Un {swing} % de swing y una reverb corta en la palmada lo mantienen crudo.',
    },
    variations: {
      en: ['Drop the clap for three bars and bring it back on the fourth: the bass line carries the groove on its own.', 'Move the open hat one step later (steps 4, 8, 12 and 16) for a looser, shuffled ride.'],
      fr: ['Retire le clap trois mesures et remets-le à la quatrième : la ligne de basse porte le groove seule.', 'Décale le charley ouvert d\'un pas (pas 4, 8, 12 et 16) pour un roulement plus lâche.'],
      es: ['Quita la palmada tres compases y devuélvela en el cuarto: la línea de bajo lleva el groove sola.', 'Mueve el charles abierto un paso más tarde (pasos 4, 8, 12 y 16) para un ride más suelto.'],
    },
  },
  {
    slug: 'dark-disco',
    factory: 'DARK DISCO',
    name: { en: 'Dark disco', fr: 'dark disco', es: 'dark disco' },
    check: { SD: [5, 13, 16], CP: [5, 13], TOM: [11], HT: [8] },
    song: { id: 'voodoo', title: 'Voodoo' },
    intro: {
      en: 'Dark disco slows the four on the floor down and darkens it, somewhere between Italo, new wave and EBM. It is the sound Maudite Machine plays the most in his DJ sets.',
      fr: "La dark disco ralentit le four on the floor et l'assombrit, quelque part entre l'italo, la new wave et l'EBM. C'est le son que Maudite Machine joue le plus en DJ set.",
      es: 'El dark disco frena el four on the floor y lo oscurece, entre el italo, la new wave y el EBM. Es el sonido que Maudite Machine más pincha en sus DJ sets.',
    },
    why: {
      en: 'A straight kick on every beat, the snare and a softer clap stacked on 2 and 4, and a ghost snare on step 16 that leans into the next bar. The closed hats play human sixteenths (6, 4, 0, 7), the open hat breathes on the off-beats, and two toms, a low one on step 11 and a high one on step 8, give it the swing of a conga. {swing}% swing, a little drive and reverb on the snare.',
      fr: "Un kick droit sur chaque temps, la caisse claire et un clap plus doux empilés sur 2 et 4, et une caisse claire fantôme au pas 16 qui penche vers la mesure suivante. Les charleys fermés jouent des doubles croches humaines (6, 4, 0, 7), l'ouvert respire sur les contretemps, et deux toms, un grave au pas 11 et un aigu au pas 8, donnent le balancement d'une conga. {swing} % de swing, un peu de drive et de reverb sur la caisse claire.",
      es: 'Un bombo recto en cada tiempo, la caja y una palmada más suave apiladas en el 2 y el 4, y una caja fantasma en el paso 16 que empuja hacia el compás siguiente. Los charles cerrados tocan semicorcheas humanas (6, 4, 0, 7), el abierto respira en los contratiempos y dos toms, uno grave en el paso 11 y uno agudo en el 8, le dan el vaivén de una conga. {swing} % de swing, algo de drive y reverb en la caja.',
    },
    variations: {
      en: ['Add a clap on step 15 every fourth bar to announce the next phrase.', 'Mute the closed hats for eight bars and keep only the open hat: the track opens up before the drop.'],
      fr: ['Ajoute un clap au pas 15 toutes les quatre mesures pour annoncer la phrase suivante.', 'Coupe les charleys fermés huit mesures et garde seulement l\'ouvert : le morceau respire avant le retour.'],
      es: ['Añade una palmada en el paso 15 cada cuatro compases para anunciar la frase siguiente.', 'Silencia los charles cerrados ocho compases y deja solo el abierto: el tema respira antes del drop.'],
    },
  },
  {
    slug: 'indie-dance',
    factory: 'INDIE DANCE',
    name: { en: 'Indie dance', fr: 'indie dance', es: 'indie dance' },
    check: { CH: [16], HT: [4, 12], TOM: [8] },
    song: { id: 'voodoo', title: 'Voodoo' },
    intro: {
      en: 'Indie dance puts the energy of rock and new wave on a club grid: punchy drums, hats that drive, and percussion that answers the bass line.',
      fr: "L'indie dance pose l'énergie du rock et de la new wave sur une grille de club : une batterie qui claque, des charleys qui poussent et des percussions qui répondent à la basse.",
      es: 'El indie dance pone la energía del rock y la new wave sobre una rejilla de club: batería que pega, charles que empujan y percusiones que responden al bajo.',
    },
    why: {
      en: 'The kick hits every beat with a sharp attack, snare and clap land together on 2 and 4. The closed hats push hard (8, 5, 0, 8) with an extra accent on the last step, the open hat keeps the off-beats, and two toms play off the grid: high on steps 4 and 12, low on step 8. Almost no swing ({swing}%): it stays tight like a band.',
      fr: "Le kick frappe chaque temps avec une attaque nette, caisse claire et clap tombent ensemble sur 2 et 4. Les charleys fermés poussent fort (8, 5, 0, 8) avec un accent de plus sur le dernier pas, l'ouvert tient les contretemps, et deux toms jouent hors de la grille : l'aigu aux pas 4 et 12, le grave au pas 8. Presque pas de swing ({swing} %) : ça reste serré comme un groupe.",
      es: 'El bombo pega en cada tiempo con un ataque seco, caja y palmada caen juntas en el 2 y el 4. Los charles cerrados empujan fuerte (8, 5, 0, 8) con un acento más en el último paso, el abierto mantiene los contratiempos y dos toms tocan fuera de la rejilla: el agudo en los pasos 4 y 12, el grave en el 8. Casi sin swing ({swing} %): se queda apretado como una banda.',
    },
    variations: {
      en: ["Double the snare on step 16 at the end of each phrase, like a drummer's fill.", 'Swap the open hats for the cymbal on the off-beats for a brighter chorus.'],
      fr: ['Double la caisse claire au pas 16 à la fin de chaque phrase, comme le fill d\'un batteur.', 'Remplace les charleys ouverts par la cymbale sur les contretemps pour un refrain plus brillant.'],
      es: ['Dobla la caja en el paso 16 al final de cada frase, como el fill de un batería.', 'Cambia los charles abiertos por el platillo en los contratiempos para un estribillo más brillante.'],
    },
  },
  {
    slug: 'minimal',
    factory: 'MINIMAL',
    name: { en: 'Minimal', fr: 'minimal', es: 'minimal' },
    check: { SD: [8], TOM: [7, 16], HT: [4, 10], OH: [15] },
    intro: {
      en: 'Minimal house and techno, in the line of Raresh, Rhadoo or Villalobos, is all about space: short sounds, a heavy swing and small percussion parts that answer each other.',
      fr: "La minimale, dans la lignée de Raresh, Rhadoo ou Villalobos, est une affaire d'espace : des sons courts, un swing lourd et de petites percussions qui se répondent.",
      es: 'El minimal, en la línea de Raresh, Rhadoo o Villalobos, es cuestión de espacio: sonidos cortos, un swing pesado y pequeñas percusiones que se responden.',
    },
    why: {
      en: 'A short, round kick on every beat and a soft clap on 2 and 4. Nothing else sits on the beat: the closed hat plays a shaker line with uneven dynamics (6, 3, 8, 5), the snare whispers once on step 8, the open hat once on step 15, and tuned toms answer each other, low on steps 7 and 16, high on steps 4 and 10. The swing is heavy ({swing}%) and the delay fills the space.',
      fr: "Un kick court et rond sur chaque temps et un clap doux sur 2 et 4. Rien d'autre sur les temps : le charley fermé joue une ligne de shaker aux dynamiques inégales (6, 3, 8, 5), la caisse claire chuchote une fois au pas 8, l'ouvert une fois au pas 15, et des toms accordés se répondent, graves aux pas 7 et 16, aigus aux pas 4 et 10. Le swing est lourd ({swing} %) et le delay remplit l'espace.",
      es: 'Un bombo corto y redondo en cada tiempo y una palmada suave en el 2 y el 4. Nada más sobre los tiempos: el charles cerrado toca una línea de shaker con dinámicas desiguales (6, 3, 8, 5), la caja susurra una vez en el paso 8, el abierto una vez en el 15, y toms afinados se responden, graves en los pasos 7 y 16, agudos en el 4 y el 10. El swing es pesado ({swing} %) y el delay llena el espacio.',
    },
    variations: {
      en: ['Shift the high tom by one step every eight bars: the groove moves without changing.', 'Take the clap out and let the ghost snare carry the backbeat.'],
      fr: ['Décale le tom aigu d\'un pas toutes les huit mesures : le groove bouge sans changer.', 'Retire le clap et laisse la caisse claire fantôme porter le contretemps.'],
      es: ['Desplaza el tom agudo un paso cada ocho compases: el groove se mueve sin cambiar.', 'Quita la palmada y deja que la caja fantasma lleve el contratiempo.'],
    },
  },
  {
    slug: 'rolling-techno',
    factory: 'ROLLING',
    name: { en: 'Rolling techno', fr: 'rolling techno', es: 'rolling techno' },
    check: { OH: [3, 7, 11, 15], CP: [5, 13] },
    intro: {
      en: 'Rolling techno is built for long, driving sets: a short kick on every beat and the bass rolling on the three sixteenths after it (kick, bass, bass, bass).',
      fr: 'La rolling techno est faite pour les longs sets qui avancent : un kick court sur chaque temps et la basse qui roule sur les trois doubles croches qui le suivent (kick, basse, basse, basse).',
      es: 'El rolling techno está hecho para sets largos que avanzan: un bombo corto en cada tiempo y el bajo rodando en las tres semicorcheas que lo siguen (bombo, bajo, bajo, bajo).',
    },
    why: {
      en: 'The kick is short, its tail cut so the bass can roll right after it. Clap and snare are bright on 2 and 4, the open hat is loud on every off-beat and the closed hats keep the sixteenths with accents (8, 5, 0, 7). No swing at all ({swing}%): it runs like a machine.',
      fr: "Le kick est court, sa queue coupée pour que la basse roule juste après lui. Clap et caisse claire brillent sur 2 et 4, le charley ouvert est fort sur chaque contretemps et les fermés tiennent les doubles croches avec leurs accents (8, 5, 0, 7). Aucun swing ({swing} %) : ça tourne comme une machine.",
      es: 'El bombo es corto, con la cola cortada para que el bajo ruede justo después. Palmada y caja brillan en el 2 y el 4, el charles abierto suena fuerte en cada contratiempo y los cerrados mantienen las semicorcheas con sus acentos (8, 5, 0, 7). Nada de swing ({swing} %): gira como una máquina.',
    },
    variations: {
      en: ['Add a ghost snare on step 15 to make the loop turn faster.', 'Every sixteen bars, drop the kick for one bar and keep the hats: the return hits harder.'],
      fr: ['Ajoute une caisse claire fantôme au pas 15 pour que la boucle tourne plus vite.', 'Toutes les seize mesures, coupe le kick une mesure et garde les charleys : le retour frappe plus fort.'],
      es: ['Añade una caja fantasma en el paso 15 para que el bucle gire más rápido.', 'Cada dieciséis compases, quita el bombo un compás y deja los charles: la vuelta pega más fuerte.'],
    },
  },
  {
    slug: 'techno',
    factory: 'TECHNO',
    name: { en: 'Techno', fr: 'techno', es: 'techno' },
    check: { SD: [15], TOM: [10, 14], OH: [3, 7, 11, 15] },
    intro: {
      en: 'Warehouse techno, the Berlin way (Ben Klock, Marcel Dettmann): a long, low kick, the open hat on every off-beat and saturation on everything.',
      fr: 'La techno de hangar, façon Berlin (Ben Klock, Marcel Dettmann) : un kick long et grave, le charley ouvert sur chaque contretemps et de la saturation sur tout.',
      es: 'El techno de nave, al estilo de Berlín (Ben Klock, Marcel Dettmann): un bombo largo y grave, el charles abierto en cada contratiempo y saturación en todo.',
    },
    why: {
      en: 'The kick is long and low with plenty of drive, the open hat lands on every off-beat with closed sixteenths under it (7, 5, 0, 7), a discreet clap marks 2 and 4, a ghost snare sits on step 15 and two low toms on steps 10 and 14 add movement, their echoes delayed. {swing}% swing, heavy drive.',
      fr: "Le kick est long et grave avec beaucoup de drive, le charley ouvert tombe sur chaque contretemps avec les doubles croches fermées dessous (7, 5, 0, 7), un clap discret marque 2 et 4, une caisse claire fantôme se pose au pas 15 et deux toms graves aux pas 10 et 14 ajoutent du mouvement, leurs échos en delay. {swing} % de swing, beaucoup de drive.",
      es: 'El bombo es largo y grave con mucho drive, el charles abierto cae en cada contratiempo con las semicorcheas cerradas debajo (7, 5, 0, 7), una palmada discreta marca el 2 y el 4, una caja fantasma va en el paso 15 y dos toms graves en los pasos 10 y 14 añaden movimiento, con sus ecos en delay. {swing} % de swing, mucho drive.',
    },
    variations: {
      en: ['Open the delay on the toms only: their echoes become a second percussion line.', 'Remove the clap and let the kick and the open hat do the work, for a darker intro.'],
      fr: ['Ouvre le delay sur les toms seulement : leurs échos deviennent une deuxième ligne de percussions.', 'Retire le clap et laisse le kick et le charley ouvert faire le travail, pour une intro plus sombre.'],
      es: ['Abre el delay solo en los toms: sus ecos se vuelven una segunda línea de percusión.', 'Quita la palmada y deja que el bombo y el charles abierto hagan el trabajo, para una intro más oscura.'],
    },
  },
  {
    slug: 'house',
    factory: 'HOUSE',
    name: { en: 'House', fr: 'house', es: 'house' },
    check: { TOM: [8, 14], HT: [4, 12], SD: [16] },
    intro: {
      en: 'From Chicago to deep house (Larry Heard, Kerri Chandler): the swing of the MPC, a 909 kick and clap, open hats on the off-beats and congas.',
      fr: "De Chicago à la deep house (Larry Heard, Kerri Chandler) : le swing de la MPC, le kick et le clap d'une 909, des charleys ouverts sur les contretemps et des congas.",
      es: 'De Chicago al deep house (Larry Heard, Kerri Chandler): el swing de la MPC, el bombo y la palmada de una 909, charles abiertos en los contratiempos y congas.',
    },
    why: {
      en: 'Kick on every beat, the clap loud on 2 and 4, open hats on the off-beats and a swung shaker in the closed hat (5, 4, 0, 6). The toms play conga parts, low on steps 8 and 14, high on steps 4 and 12, and a ghost snare closes the bar on step 16. The swing is the key: {swing}%.',
      fr: "Kick sur chaque temps, clap fort sur 2 et 4, charleys ouverts sur les contretemps et un shaker swingué dans le charley fermé (5, 4, 0, 6). Les toms jouent des parties de congas, graves aux pas 8 et 14, aigus aux pas 4 et 12, et une caisse claire fantôme ferme la mesure au pas 16. Le swing fait tout : {swing} %.",
      es: 'Bombo en cada tiempo, palmada fuerte en el 2 y el 4, charles abiertos en los contratiempos y un shaker con swing en el charles cerrado (5, 4, 0, 6). Los toms tocan partes de conga, graves en los pasos 8 y 14, agudos en el 4 y el 12, y una caja fantasma cierra el compás en el paso 16. El swing lo es todo: {swing} %.',
    },
    variations: {
      en: ['Push the swing a little further for a deeper, lazier groove.', 'Add a closed hat on every step at a low velocity under the shaker, for a garage feel.'],
      fr: ['Pousse le swing un peu plus loin pour un groove plus deep, plus paresseux.', 'Ajoute un charley fermé sur chaque pas, à faible vélocité, sous le shaker, pour une couleur garage.'],
      es: ['Empuja el swing un poco más para un groove más profundo y perezoso.', 'Añade un charles cerrado en cada paso, a poca velocidad, bajo el shaker, para un toque garage.'],
    },
  },
  {
    slug: 'electro',
    factory: 'ELECTRO',
    name: { en: 'Electro', fr: 'électro', es: 'electro' },
    check: { BD: [1, 7, 11], TOM: [15], HT: [16] },
    intro: {
      en: 'Detroit electro (Drexciya, Aux 88, after Kraftwerk) does not play four on the floor: the kick syncopates and the 808 does the talking.',
      fr: "L'électro de Detroit (Drexciya, Aux 88, après Kraftwerk) ne joue pas le four on the floor : le kick syncope et la 808 fait la conversation.",
      es: 'El electro de Detroit (Drexciya, Aux 88, después de Kraftwerk) no toca four on the floor: el bombo sincopa y la 808 lleva la conversación.',
    },
    why: {
      en: 'The kick plays step 1, then steps 7 and 11, the "and" of the second and third beats. Snare and a softer clap land on 2 and 4, the 808 closed hats run in sixteenths (8, 5) and stop for the last two steps, where a low tom (step 15) and a high tom (step 16) finish the bar. {swing}% swing.',
      fr: "Le kick joue le pas 1, puis les pas 7 et 11, le « et » des deuxième et troisième temps. Caisse claire et clap plus doux tombent sur 2 et 4, les charleys fermés de 808 filent en doubles croches (8, 5) et s'arrêtent pour les deux derniers pas, où un tom grave (pas 15) et un tom aigu (pas 16) finissent la mesure. {swing} % de swing.",
      es: 'El bombo toca el paso 1 y luego los pasos 7 y 11, el "y" del segundo y del tercer tiempo. Caja y una palmada más suave caen en el 2 y el 4, los charles cerrados de 808 corren en semicorcheas (8, 5) y paran en los dos últimos pasos, donde un tom grave (paso 15) y uno agudo (paso 16) cierran el compás. {swing} % de swing.',
    },
    variations: {
      en: ['Move the third kick from step 11 to step 12 for a broken, funkier bar.', 'Add the cymbal on step 1 every four bars to mark the phrase, as on an 808 record.'],
      fr: ['Déplace le troisième kick du pas 11 au pas 12 pour une mesure cassée, plus funky.', 'Ajoute la cymbale au pas 1 toutes les quatre mesures pour marquer la phrase, comme sur un disque à la 808.'],
      es: ['Mueve el tercer bombo del paso 11 al 12 para un compás roto, más funky.', 'Añade el platillo en el paso 1 cada cuatro compases para marcar la frase, como en un disco de 808.'],
    },
  },
  {
    slug: 'ebm',
    factory: 'EBM',
    name: { en: 'EBM', fr: 'EBM', es: 'EBM' },
    check: { CH: [1, 3, 5, 7, 9, 11, 13, 15], SD: [5, 13], CP: [5, 13] },
    intro: {
      en: 'Electronic Body Music (DAF, Front 242, Nitzer Ebb) is square and martial: a hard kick, a big gated snare and no swing at all.',
      fr: "L'Electronic Body Music (DAF, Front 242, Nitzer Ebb) est carrée et martiale : un kick dur, une grosse caisse claire à porte et aucun swing.",
      es: 'La Electronic Body Music (DAF, Front 242, Nitzer Ebb) es cuadrada y marcial: un bombo duro, una caja grande con puerta y nada de swing.',
    },
    why: {
      en: 'Kick on every beat, hard and saturated, a big snare on 2 and 4 with a gated clap under it, and closed hats on every eighth note at one flat velocity (7). No swing ({swing}%) and no ghost notes: the strictness is the style. The drive is pushed and the long tail of the snare is cut by its decay.',
      fr: "Kick sur chaque temps, dur et saturé, une grosse caisse claire sur 2 et 4 avec un clap à porte dessous, et des charleys fermés sur chaque croche à une seule vélocité (7). Pas de swing ({swing} %) ni de notes fantômes : la rigueur, c'est le style. Le drive est poussé et la longue queue de la caisse claire est coupée par son decay.",
      es: 'Bombo en cada tiempo, duro y saturado, una caja grande en el 2 y el 4 con una palmada con puerta debajo, y charles cerrados en cada corchea a una sola velocidad (7). Sin swing ({swing} %) ni notas fantasma: la rigidez es el estilo. El drive va a tope y la cola larga de la caja se corta con su decay.',
    },
    variations: {
      en: ['Add a closed hat on every sixteenth for the chorus, still at one velocity.', 'Leave the clap alone on step 13 for one bar out of four: a short break before the next phrase.'],
      fr: ['Ajoute un charley fermé sur chaque double croche pour le refrain, toujours à une seule vélocité.', 'Laisse le clap seul au pas 13 une mesure sur quatre : une courte cassure avant la phrase suivante.'],
      es: ['Añade un charles cerrado en cada semicorchea para el estribillo, siempre a una sola velocidad.', 'Deja la palmada sola en el paso 13 un compás de cada cuatro: un corte breve antes de la frase siguiente.'],
    },
  },
  {
    slug: 'italo-disco',
    factory: 'ITALO',
    name: { en: 'Italo disco', fr: 'italo disco', es: 'italo disco' },
    check: { TOM: [14], HT: [15], OH: [3, 7, 11, 15] },
    intro: {
      en: 'Italo disco (Giorgio Moroder, Klein + M.B.O., Kano) is the sound of early 1980s drum machines: a straight kick, a dry snare and bouncing octave bass lines.',
      fr: "L'italo disco (Giorgio Moroder, Klein + M.B.O., Kano), c'est le son des boîtes à rythmes du début des années 1980 : un kick droit, une caisse claire sèche et des basses en octaves qui rebondissent.",
      es: 'El italo disco (Giorgio Moroder, Klein + M.B.O., Kano) es el sonido de las cajas de ritmos de principios de los 80: un bombo recto, una caja seca y bajos en octavas que rebotan.',
    },
    why: {
      en: 'Kick on every beat, a dry snare and a soft clap on 2 and 4, sixteenth closed hats (7, 5, 0, 7), the open hat on the off-beats and a small tom fill at the end of the bar, low on step 14 and high on step 15. No swing ({swing}%): the groove comes from the bass and the arpeggio, and chorus and delay give the 80s shine.',
      fr: "Kick sur chaque temps, caisse claire sèche et clap doux sur 2 et 4, charleys fermés en doubles croches (7, 5, 0, 7), l'ouvert sur les contretemps et une petite relance de toms en fin de mesure, grave au pas 14 et aigu au pas 15. Pas de swing ({swing} %) : le groove vient de la basse et de l'arpège, chorus et delay donnent le brillant des années 80.",
      es: 'Bombo en cada tiempo, caja seca y palmada suave en el 2 y el 4, charles cerrados en semicorcheas (7, 5, 0, 7), el abierto en los contratiempos y un pequeño redoble de toms al final del compás, grave en el paso 14 y agudo en el 15. Sin swing ({swing} %): el groove viene del bajo y del arpegio, y el chorus y el delay dan el brillo de los 80.',
    },
    variations: {
      en: ['Add an open hat on step 16 to lift the loop into the next bar.', 'Double the snare with the clap at full velocity for the chorus.'],
      fr: ['Ajoute un charley ouvert au pas 16 pour relancer la boucle vers la mesure suivante.', 'Double la caisse claire avec le clap à pleine vélocité pour le refrain.'],
      es: ['Añade un charles abierto en el paso 16 para lanzar el bucle al compás siguiente.', 'Dobla la caja con la palmada a toda velocidad para el estribillo.'],
    },
  },
];

/* ---------------- les mots de l'interface ---------------- */

const VOICE_NAMES = {
  en: { BD: 'Kick (BD)', SD: 'Snare (SD)', CH: 'Closed hat (CH)', OH: 'Open hat (OH)', CP: 'Clap (CP)', TOM: 'Low tom (TOM)', HT: 'High tom (HT)', CY: 'Cymbal (CY)' },
  fr: { BD: 'Kick (BD)', SD: 'Caisse claire (SD)', CH: 'Charley fermé (CH)', OH: 'Charley ouvert (OH)', CP: 'Clap (CP)', TOM: 'Tom grave (TOM)', HT: 'Tom aigu (HT)', CY: 'Cymbale (CY)' },
  es: { BD: 'Bombo (BD)', SD: 'Caja (SD)', CH: 'Charles cerrado (CH)', OH: 'Charles abierto (OH)', CP: 'Palmada (CP)', TOM: 'Tom grave (TOM)', HT: 'Tom agudo (HT)', CY: 'Platillo (CY)' },
};

const UI = {
  en: {
    base: '/mm-studio/drum-patterns/',
    hubTitle: 'Drum Patterns for 10 Electronic Styles | MM-RYTM',
    hubDescription: 'Free drum machine patterns for dark disco, italo, EBM, acid house, techno, house, electro, minimal and more: the grid, a MIDI file and a link to play each one.',
    hubH1: 'Drum patterns',
    hubLead: 'Ten styles · grid, MIDI and a playable beat · MM-RYTM by Maudite Machine',
    hubIntro: 'Ten drum machine patterns, one per style of electronic music, written by hand by Maudite Machine from the way each style is built: where the kick falls, where the clap goes, how the hats move and how much swing they need. Each page gives the 16-step grid with its velocities, why the pattern works, two variations, a MIDI file for your DAW and a link that opens the beat, kit and effects included, in MM-RYTM, the free drum machine of MM-STUDIO.',
    title: (n, bpm) => `${titleCase(n)} Drum Pattern (${bpm} BPM) | MM-RYTM`,
    description: (n, bpm, swing) => `${n} drum pattern at ${bpm} BPM, ${swing}% swing: the 16-step grid with velocities, why it works, two variations, a free MIDI file and a beat to play.`,
    h1: (n) => `${n} drum pattern`,
    lead: (bpm, swing) => `${bpm} BPM · ${swing}% swing · 16 steps · MM-RYTM`,
    gridTitle: 'The pattern',
    gridCaption: (n, bpm) => `${n} drum pattern at ${bpm} BPM, 16 steps. Each number is the velocity of the step, 9 the loudest and 3 a ghost note; an empty cell is a rest.`,
    voice: 'Voice',
    sound: (kick, snare, hh, cp) => `The sounds in MM-RYTM: kick ${kick}, snare ${snare}, hats ${hh}, clap ${cp}.`,
    whyTitle: 'Why it works',
    varTitle: 'Two variations',
    howTitle: 'Program it on any drum machine',
    how: (bpm, swing) => [`Set the tempo to ${bpm} BPM and the swing to ${swing}% (50% is straight).`, 'Program one voice at a time from the grid, starting with the kick, then the snare and clap, then the hats.', 'Use the numbers as velocities: on a machine with only accents, accent the 8s and 9s and leave the 3s and 4s as soft notes.', 'Or skip all that: open the beat below in MM-RYTM, every step, sound and effect is already set.'],
    playTitle: 'Play it, download it',
    play: 'Play this beat in MM-RYTM',
    midi: (f) => `Download the MIDI file (${f})`,
    midiNote: 'General MIDI drum notes: kick 36, snare 38, clap 39, closed hat 42, open hat 46, low tom 45, high tom 50, cymbal 49. One bar, swing included.',
    shareNote: 'Change it, then press SHARE in the header of MM-STUDIO: you get a link to your own version.',
    moreTitle: 'More drum patterns',
    artistTitle: 'From Maudite Machine',
    artist: (song) => (song ? [`Hear the style in a track: [${song.title}](/tracks/${song.id}/)`, '[All the tracks and releases](/tracks/)'] : ['[Maudite Machine tracks and releases](/tracks/)']),
    tool: ['[MM-RYTM, the free online drum machine](/mm-studio/drum-machine/)', '[MM-STUDIO: drum machine, synth and DJ decks](/mm-studio/)'],
    cta: 'Play this beat',
    hubCta: 'Open MM-RYTM',
    listTitle: 'The ten patterns',
    crumb: 'Drum patterns',
    imageAlt: (n, bpm) => `The ${n} drum pattern at ${bpm} BPM on a 16-step grid, by MM-RYTM`,
  },
  fr: {
    base: '/fr/mm-studio/rythmes/',
    hubTitle: 'Rythmes de boîte à rythmes : 10 styles électro | MM-RYTM',
    hubDescription: "Rythmes de boîte à rythmes gratuits : dark disco, italo, EBM, acid house, techno, house, électro, minimal. Grille, fichier MIDI et beat jouable pour chacun.",
    hubH1: 'Rythmes de batterie',
    hubLead: 'Dix styles · grille, MIDI et beat jouable · MM-RYTM by Maudite Machine',
    hubIntro: "Dix rythmes de boîte à rythmes, un par style de musique électronique, écrits à la main par Maudite Machine d'après la construction de chaque style : où tombe le kick, où va le clap, comment bougent les charleys et combien de swing il leur faut. Chaque page donne la grille de 16 pas avec ses vélocités, pourquoi le rythme marche, deux variations, un fichier MIDI pour ton logiciel et un lien qui ouvre le beat, kit et effets compris, dans MM-RYTM, la boîte à rythmes gratuite de MM-STUDIO.",
    title: (n, bpm) => `Rythme ${n} à la boîte à rythmes (${bpm} BPM)`,
    description: (n, bpm, swing) => `Rythme ${n} à ${bpm} BPM, ${swing} % de swing : la grille de 16 pas et ses vélocités, pourquoi il marche, deux variations, un fichier MIDI gratuit.`,
    h1: (n) => `Rythme ${n}`,
    lead: (bpm, swing) => `${bpm} BPM · ${swing} % de swing · 16 pas · MM-RYTM`,
    gridTitle: 'Le rythme',
    gridCaption: (n, bpm) => `Rythme ${n} à ${bpm} BPM, 16 pas. Chaque chiffre est la vélocité du pas, 9 le plus fort, 3 une note fantôme ; une case vide est un silence.`,
    voice: 'Voix',
    sound: (kick, snare, hh, cp) => `Les sons dans MM-RYTM : kick ${kick}, caisse claire ${snare}, charleys ${hh}, clap ${cp}.`,
    whyTitle: 'Pourquoi ça marche',
    varTitle: 'Deux variations',
    howTitle: "Le programmer sur n'importe quelle boîte à rythmes",
    how: (bpm, swing) => [`Règle le tempo à ${bpm} BPM et le swing à ${swing} % (50 % : droit).`, 'Programme une voix à la fois depuis la grille : le kick, puis la caisse claire et le clap, puis les charleys.', 'Prends les chiffres comme des vélocités : sur une machine qui n\'a que des accents, accentue les 8 et les 9 et laisse les 3 et les 4 en notes douces.', 'Ou passe directement au beat : ouvre-le ci-dessous dans MM-RYTM, chaque pas, chaque son et chaque effet sont déjà réglés.'],
    playTitle: 'Le jouer, le télécharger',
    play: 'Jouer ce beat dans MM-RYTM',
    midi: (f) => `Télécharger le fichier MIDI (${f})`,
    midiNote: 'Notes de batterie General MIDI : kick 36, caisse claire 38, clap 39, charley fermé 42, charley ouvert 46, tom grave 45, tom aigu 50, cymbale 49. Une mesure, swing compris.',
    shareNote: "Modifie-le, puis appuie sur SHARE dans l'en-tête de MM-STUDIO : tu obtiens le lien de ta version.",
    moreTitle: 'Autres rythmes',
    artistTitle: 'Par Maudite Machine',
    artist: (song) => (song ? [`Le style dans un morceau : [${song.title}](/tracks/${song.id}/)`, '[Tous les morceaux et sorties](/tracks/)'] : ['[Les morceaux et sorties de Maudite Machine](/tracks/)']),
    tool: ['[MM-RYTM, la boîte à rythmes en ligne gratuite](/fr/mm-studio/boite-a-rythmes/)', '[MM-STUDIO : boîte à rythmes, synthé et platines DJ](/fr/mm-studio/)'],
    cta: 'Jouer ce beat',
    hubCta: 'Ouvrir MM-RYTM',
    listTitle: 'Les dix rythmes',
    crumb: 'Rythmes',
    imageAlt: (n, bpm) => `Le rythme ${n} à ${bpm} BPM sur une grille de 16 pas, par MM-RYTM`,
  },
  es: {
    base: '/es/mm-studio/ritmos/',
    hubTitle: 'Ritmos de caja de ritmos: 10 estilos electrónicos | MM-RYTM',
    hubDescription: 'Ritmos de caja de ritmos gratis: dark disco, italo, EBM, acid house, techno, house, electro, minimal. La rejilla, un archivo MIDI y un beat para tocar.',
    hubH1: 'Ritmos de batería',
    hubLead: 'Diez estilos · rejilla, MIDI y beat para tocar · MM-RYTM by Maudite Machine',
    hubIntro: 'Diez ritmos de caja de ritmos, uno por estilo de música electrónica, escritos a mano por Maudite Machine a partir de cómo se construye cada estilo: dónde cae el bombo, dónde va la palmada, cómo se mueven los charles y cuánto swing necesitan. Cada página da la rejilla de 16 pasos con sus velocidades, por qué funciona, dos variaciones, un archivo MIDI para tu DAW y un enlace que abre el beat, con kit y efectos, en MM-RYTM, la caja de ritmos gratis de MM-STUDIO.',
    title: (n, bpm) => `Patrón de batería ${n} (${bpm} BPM) | MM-RYTM`,
    description: (n, bpm, swing) => `Patrón de batería ${n} a ${bpm} BPM con ${swing} % de swing: la rejilla de 16 pasos con velocidades, por qué funciona, dos variaciones y un MIDI gratis.`,
    h1: (n) => `Patrón de batería ${n}`,
    lead: (bpm, swing) => `${bpm} BPM · ${swing} % de swing · 16 pasos · MM-RYTM`,
    gridTitle: 'El patrón',
    gridCaption: (n, bpm) => `Patrón ${n} a ${bpm} BPM, 16 pasos. Cada número es la velocidad del paso, 9 la más fuerte y 3 una nota fantasma; una casilla vacía es un silencio.`,
    voice: 'Voz',
    sound: (kick, snare, hh, cp) => `Los sonidos en MM-RYTM: bombo ${kick}, caja ${snare}, charles ${hh}, palmada ${cp}.`,
    whyTitle: 'Por qué funciona',
    varTitle: 'Dos variaciones',
    howTitle: 'Programarlo en cualquier caja de ritmos',
    how: (bpm, swing) => [`Pon el tempo a ${bpm} BPM y el swing a ${swing} % (50 %: recto).`, 'Programa una voz cada vez desde la rejilla: el bombo, luego la caja y la palmada, luego los charles.', 'Usa los números como velocidades: en una máquina que solo tiene acentos, acentúa los 8 y los 9 y deja los 3 y los 4 como notas suaves.', 'O ve directo al beat: ábrelo abajo en MM-RYTM, cada paso, sonido y efecto ya está ajustado.'],
    playTitle: 'Tocarlo, descargarlo',
    play: 'Tocar este beat en MM-RYTM',
    midi: (f) => `Descargar el archivo MIDI (${f})`,
    midiNote: 'Notas de batería General MIDI: bombo 36, caja 38, palmada 39, charles cerrado 42, charles abierto 46, tom grave 45, tom agudo 50, platillo 49. Un compás, con swing.',
    shareNote: 'Cámbialo y pulsa SHARE en la cabecera de MM-STUDIO: obtienes el enlace de tu versión.',
    moreTitle: 'Más ritmos',
    artistTitle: 'De Maudite Machine',
    artist: (song) => (song ? [`El estilo en un tema: [${song.title}](/tracks/${song.id}/)`, '[Todos los temas y lanzamientos](/tracks/)'] : ['[Temas y lanzamientos de Maudite Machine](/tracks/)']),
    tool: ['[MM-RYTM, la caja de ritmos online gratis](/es/mm-studio/caja-de-ritmos/)', '[MM-STUDIO: caja de ritmos, sintetizador y platos DJ](/es/mm-studio/)'],
    cta: 'Tocar este beat',
    hubCta: 'Abrir MM-RYTM',
    listTitle: 'Los diez ritmos',
    crumb: 'Ritmos',
    imageAlt: (n, bpm) => `El patrón ${n} a ${bpm} BPM en una rejilla de 16 pasos, por MM-RYTM`,
  },
};

/** La premiere lettre en capitale ; chaque mot (les titres anglais). */
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const titleCase = (s) => String(s).split(' ').map(cap).join(' ');

const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/* ---------------- le MIDI (un petit ecrivain SMF, aucune dependance) ---------------- */

/** Les notes General MIDI des voix (canal 10). */
const GM = { BD: 36, SD: 38, CP: 39, CH: 42, OH: 46, TOM: 45, HT: 50, CY: 49 };
/** La velocite MIDI d'un niveau (le gain de la machine, audio/pattern.ts VEL_GAIN). */
const VEL_GAIN = [0, 0.16, 0.26, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const PPQ = 96;
const STEP_TICKS = PPQ / 4;

const vlq = (n) => {
  const out = [n & 0x7f];
  let v = n >> 7;
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return out;
};

/** Un fichier MIDI de type 0, une mesure en 4/4 : tempo, nom, les coups de la grille (le swing sur les pas pairs). */
export function midiOf(name, bpm, swing, steps) {
  const ev = [];
  const delay = Math.round(((swingPct(swing) - 50) / 50) * STEP_TICKS);
  for (const inst of INSTS) {
    const row = steps[inst] ?? '';
    for (let i = 0; i < 16; i += 1) {
      const lv = row.charCodeAt(i) - 48;
      if (!(lv >= 1 && lv <= 9)) continue;
      const at = i * STEP_TICKS + (i % 2 === 1 ? delay : 0);
      const vel = Math.max(1, Math.min(127, Math.round(127 * VEL_GAIN[lv])));
      ev.push([at, 0x99, GM[inst], vel], [at + STEP_TICKS / 2, 0x89, GM[inst], 0]);
    }
  }
  // Dans l'ordre du temps, les fins de note avant les debuts au meme instant
  ev.sort((a, b) => a[0] - b[0] || (a[1] === 0x89 ? 0 : 1) - (b[1] === 0x89 ? 0 : 1));
  const mpqn = Math.round(60000000 / bpm);
  const title = Buffer.from(name, 'latin1');
  const track = [0, 0xff, 0x03, ...vlq(title.length), ...title, 0, 0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff, 0, 0xff, 0x58, 0x04, 4, 2, 24, 8];
  let t = 0;
  for (const [at, st, note, vel] of ev) {
    track.push(...vlq(at - t), st, note, vel);
    t = at;
  }
  track.push(...vlq(16 * STEP_TICKS - t), 0xff, 0x2f, 0x00);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
  const len = track.length;
  return Buffer.from([...head, 0x4d, 0x54, 0x72, 0x6b, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, ...track]);
}

/* ---------------- les pages ---------------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** La grille en tableau HTML (les voix qui jouent, 16 pas, la velocite de chaque pas). */
function gridHtml(lang, g, caption) {
  const ui = UI[lang];
  const rows = INSTS.filter((k) => /[1-9]/.test(g.steps[k]));
  const head = `<tr><th scope="col">${esc(ui.voice)}</th>${Array.from({ length: 16 }, (_, i) => `<th scope="col"${i % 4 === 0 ? ' class="b"' : ''}>${i + 1}</th>`).join('')}</tr>`;
  const body = rows
    .map((k) => `<tr><th scope="row">${esc(VOICE_NAMES[lang][k])}</th>${[...g.steps[k]].map((c, i) => `<td data-v="${c}"${i % 4 === 0 ? ' class="b"' : ''}>${c === '0' ? '' : c}</td>`).join('')}</tr>`)
    .join('');
  // La legende au-dessus, hors du cadre qui defile au telephone (elle y etait coupee) ; le tableau garde son nom
  return `<p class="grid-note">${esc(caption)}</p><div class="grid-wrap"><table class="grid" aria-label="${esc(caption.split('.')[0])}"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** Le lien jouable : ?m=rytm&b=<code> (le preset d'usine par son rang, ses pas et son tempo), null sans codec. */
function playHref(g) {
  if (!CODEC) return null;
  try {
    return `${SITE}/?m=rytm&b=${CODEC.encodeBeat({ base: g.index, bpm: g.bpm, steps: g.steps })}`;
  } catch {
    return null;
  }
}

const midiName = (g) => `${g.slug}-drum-pattern-${g.bpm}bpm.mid`;
const enPath = (g) => `${UI.en.base}${g.slug}/`;
export const midiPath = (g) => `${enPath(g)}${midiName(g)}`;
export const imagePath = (g) => `${enPath(g)}${g.slug}-drum-pattern.jpg`;

/** Les styles du site : les textes de GENRES et leur preset d'usine (l'ordre du MM-RYTM). */
export const PATTERNS = GENRES.map((t) => {
  const g = RYTM.find((x) => x.name === t.factory);
  return g ? { ...t, index: g.index, bpm: g.bpm, swing: g.fx?.swing ?? 0, steps: g.steps, kick: sampleName(g.kick?.key), snare: sampleName(g.snare?.key), hh: String(g.hh ?? '').toUpperCase(), cp: String(g.cp ?? '').toUpperCase() } : null;
}).filter(Boolean);

/**
 * Les pas cites par les textes jouent-ils encore (un preset d'usine reecrit) ? La liste des ecarts, vide si tout
 * tient ; le prerender l'ecrit dans son journal (le texte d'un style est alors a relire).
 */
export function patternCheck() {
  const out = [];
  for (const t of GENRES) {
    const g = PATTERNS.find((p) => p.slug === t.slug);
    if (!g) {
      out.push(`${t.slug} : preset ${t.factory} absent de factory.ts`);
      continue;
    }
    for (const [inst, steps] of Object.entries(t.check ?? {})) for (const s of steps) if (!(g.steps[inst][s - 1] > '0')) out.push(`${t.slug} : ${inst} ne joue plus le pas ${s}`);
  }
  return out;
}

/** Les pages (le format de MM_STUDIO_PAGES, plus html : le HTML deja pret de la grille et des liens). */
function pagesOf(lang) {
  const ui = UI[lang];
  const hubPath = ui.base;
  const pages = [];
  const listItems = PATTERNS.map((g) => `[${cap(g.name[lang])} (${g.bpm} BPM)](${ui.base}${g.slug}/)`);
  pages.push({
    cluster: 'patterns',
    lang,
    path: hubPath,
    title: ui.hubTitle,
    description: ui.hubDescription,
    h1: ui.hubH1,
    lead: ui.hubLead,
    crumbs: [[ui.crumb, hubPath]],
    sections: [{ h2: null, paragraphs: [ui.hubIntro] }, { h2: ui.listTitle, items: listItems }, { h2: ui.artistTitle, items: [...ui.tool, ...ui.artist(null)] }],
    cta: { text: ui.hubCta, href: `${SITE}/?m=rytm` },
    imageAlt: ui.hubH1,
  });
  for (const g of PATTERNS) {
    const vars = { swing: swingPct(g.swing), bpm: g.bpm };
    const name = g.name[lang];
    const play = playHref(g);
    const others = PATTERNS.filter((o) => o.slug !== g.slug).map((o) => `[${cap(o.name[lang])}](${ui.base}${o.slug}/)`);
    pages.push({
      cluster: `pattern-${g.slug}`,
      lang,
      path: `${ui.base}${g.slug}/`,
      title: ui.title(name, g.bpm),
      description: ui.description(name, g.bpm, vars.swing),
      h1: ui.h1(name),
      lead: ui.lead(g.bpm, vars.swing),
      crumbs: [[ui.crumb, hubPath], [cap(name), `${ui.base}${g.slug}/`]],
      pattern: g,
      html: [`<h2>${esc(ui.gridTitle)}</h2>`, gridHtml(lang, g, ui.gridCaption(name, g.bpm)), `<p>${esc(ui.sound(g.kick || g.hh, g.snare || g.hh, g.hh, g.cp))}</p>`].join('\n      '),
      sections: [
        { h2: null, paragraphs: [g.intro[lang]] },
        { h2: ui.whyTitle, paragraphs: [fill(g.why[lang], vars)] },
        { h2: ui.varTitle, items: g.variations[lang] },
        { h2: ui.howTitle, ordered: true, items: ui.how(g.bpm, vars.swing) },
        { h2: ui.playTitle, items: [...(play ? [`[${ui.play}](${play})`] : []), `[${ui.midi(midiName(g))}](${midiPath(g)})`], paragraphs: [ui.midiNote, ui.shareNote] },
        { h2: ui.artistTitle, items: [...ui.artist(g.song), ...ui.tool] },
        { h2: ui.moreTitle, items: [`[${ui.hubH1}](${hubPath})`, ...others] },
      ],
      cta: { text: ui.cta, href: play ?? `${SITE}/?m=rytm` },
      imageAlt: ui.imageAlt(name, g.bpm),
      image: imagePath(g),
    });
  }
  return pages;
}

/** Les pages de motifs, anglais d'abord. */
export const PATTERN_PAGES = PATTERNS.length ? [...pagesOf('en'), ...pagesOf('fr'), ...pagesOf('es')] : [];

/* ---------------- l'image de partage d'un motif (sharp, au build) ---------------- */

/** L'image 1200 x 630 d'un motif : sa grille, son nom et son tempo, sur le noir des machines (SVG puis JPEG). */
export function patternSvg(g) {
  const W = 1200;
  const H = 630;
  const rows = INSTS.filter((k) => /[1-9]/.test(g.steps[k]));
  const x0 = 260;
  const cw = 52;
  const ch = Math.min(52, Math.floor(360 / Math.max(1, rows.length)));
  const y0 = 210 + Math.floor((360 - ch * rows.length) / 2);
  // Un nom long (ROLLING TECHNO) : la police se resserre pour tenir dans les 1080 px de la ligne
  const title = `${g.name.en.toUpperCase()} DRUM PATTERN`;
  const titleSize = Math.min(64, Math.floor(1080 / (title.length * 0.7)));
  const cells = rows
    .map((k, r) => {
      const label = `<text x="${x0 - 24}" y="${y0 + r * ch + ch / 2 + 9}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="700" fill="#C9C2B6">${k}</text>`;
      const boxes = [...g.steps[k]]
        .map((c, i) => {
          const v = Number(c);
          const x = x0 + i * cw + (Math.floor(i / 4) * 8);
          const fill = v === 0 ? '#1d1b17' : v >= 7 ? '#FF6A13' : v >= 4 ? '#B8501a' : '#6e3a1e';
          return `<rect x="${x}" y="${y0 + r * ch + 4}" width="${cw - 8}" height="${ch - 8}" rx="6" fill="${fill}"/>`;
        })
        .join('');
      return label + boxes;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#0C0B09"/>
<text x="60" y="110" font-family="DejaVu Sans, Arial, sans-serif" font-size="${titleSize}" font-weight="800" fill="#F1EDE5">${esc(title)}</text>
<text x="60" y="165" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" font-weight="700" fill="#FFB21E">${g.bpm} BPM · ${swingPct(g.swing)}% SWING · PLAY IT FREE ON MM-RYTM</text>
${cells}
<text x="60" y="${H - 28}" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="700" fill="#FF6A13">MAUDITEMACHINE.COM</text>
</svg>`;
}
