#!/usr/bin/env node
/**
 * La section Bio de /press et les versions /fr/press et /es/press (2026-11-07, Mika : "Sur la page /press (et ses
 * versions /fr/press et /es/press), ajoute une section Bio avant les photos", trois blocs avec un bouton Copy qui copie
 * le texte brut, "Copied" 2 s ; "utilise les versions FR et ES des bios courte et longue depuis les fichiers i18n").
 *
 * La source des bios : src/data/pressBio.json (src/translations.ts la lit aussi, pressBio). La page anglaise reste
 * public/press/index.html, servie telle quelle ; sa section Bio est rendue d'ici, entre les marques bio:start et
 * bio:end (et le choix de langue entre langs:start et langs:end), pour que le JSON gagne toujours.
 *
 *   node scripts/press-pages.mjs --public   reecrit la section Bio et le choix de langue de public/press/index.html
 *                                           (apres un changement de src/data/pressBio.json)
 *   node scripts/press-pages.mjs            (postbuild, apres scripts/prerender-seo.mjs) : la section Bio de
 *                                           dist/press/index.html, puis dist/fr/press/index.html et
 *                                           dist/es/press/index.html, traduites de la page anglaise
 *
 * Les traductions de la page sont des remplacements de textes exacts (les blancs comptent pour un) ; un texte anglais
 * absent de la page (la page a change) est signale, jamais une erreur de build, et la page sort quand meme.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE, readJson } from './seo-shared.mjs';

const BIO = readJson('src/data/pressBio.json', null);
const PUBLIC_PAGE = join(ROOT, 'public', 'press', 'index.html');
const DIST = join(ROOT, 'dist');
const LANGS = ['en', 'fr', 'es'];
const PATH = { en: '/press/', fr: '/fr/press/', es: '/es/press/' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Les mots de la section Bio, par langue ; la bio Instagram reste en anglais partout. */
const UI = {
  en: { sub: '3 texts · copy and paste', short: 'Short bio', long: 'Long bio', insta: 'Instagram bio', lang: 'EN', instaMeta: 'EN · 150 characters max', copy: 'Copy', copied: 'Copied', nav: 'Language' },
  fr: { sub: '3 textes · à copier-coller', short: 'Bio courte', long: 'Bio longue', insta: 'Bio Instagram', lang: 'FR', instaMeta: 'EN · 150 caractères max', copy: 'Copier', copied: 'Copié', nav: 'Langue' },
  es: { sub: '3 textos · para copiar y pegar', short: 'Bio corta', long: 'Bio larga', insta: 'Bio de Instagram', lang: 'ES', instaMeta: 'EN · 150 caracteres máx.', copy: 'Copiar', copied: 'Copiado', nav: 'Idioma' },
};

function bioBlock(title, meta, paragraphs, t) {
  return [
    '        <article class="bio">',
    '          <div class="bio-head">',
    `            <h3>${esc(title)}</h3>`,
    `            <span class="label">${esc(meta)}</span>`,
    `            <button class="copy" type="button" data-label="${esc(t.copy)}" data-copied="${esc(t.copied)}">${esc(t.copy)}</button>`,
    '          </div>',
    '          <div class="bio-text">',
    ...paragraphs.map((p) => `            <p>${p}</p>`),
    '          </div>',
    '        </article>',
  ].join('\n');
}

/** La section Bio d'une langue, avec ses marques (le texte des <p> est ce que Copy copie, paragraphes separes d'une ligne vide). */
export function renderBio(lang) {
  const t = UI[lang];
  const b = BIO[lang];
  return [
    '<!-- bio:start : rendue par scripts/press-pages.mjs depuis src/data/pressBio.json, ne pas editer a la main -->',
    '    <section id="bio">',
    '      <div class="head">',
    '        <h2>Bio</h2>',
    `        <span class="label">${esc(t.sub)}</span>`,
    '      </div>',
    '      <div class="bios">',
    bioBlock(t.short, t.lang, [esc(b.short)], t),
    bioBlock(t.long, t.lang, b.long.map(esc), t),
    bioBlock(t.insta, t.instaMeta, [BIO.instagram.map(esc).join('<br />')], t),
    '      </div>',
    '      <span class="sr-only" role="status" aria-live="polite" id="copy-status"></span>',
    '    </section>',
    '    <!-- bio:end -->',
  ].join('\n');
}

/** Le choix de langue de l'en-tete, la page courante marquee. */
export function renderLangs(lang) {
  const links = LANGS.map((l) => `<a href="${PATH[l]}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="page"' : ''}>${l.toUpperCase()}</a>`).join(' · ');
  return `<!-- langs:start --><nav class="label langs" aria-label="${UI[lang].nav}">${links}</nav><!-- langs:end -->`;
}

/** Remplace le bloc entre deux marques ; null si les marques manquent. */
function swapBlock(html, start, end, block) {
  const i = html.indexOf(start);
  const j = html.indexOf(end, i);
  if (i < 0 || j < 0) return null;
  return html.slice(0, i) + block + html.slice(j + end.length);
}

function withBlocks(html, lang) {
  const a = swapBlock(html, '<!-- bio:start', '<!-- bio:end -->', renderBio(lang));
  if (a === null) throw new Error('press-pages : marques bio:start / bio:end absentes de la page');
  const b = swapBlock(a, '<!-- langs:start -->', '<!-- langs:end -->', renderLangs(lang));
  if (b === null) throw new Error('press-pages : marques langs:start / langs:end absentes de la page');
  return b;
}

/* ---------------- les traductions de la page (texte anglais exact -> fr, es) ---------------- */

const TITLE_EN = 'Press Photos, Logos and Artwork | Maudite Machine';
const DESC_EN = 'Maudite Machine press assets: high resolution press photos, logos, release artwork and MM-STUDIO screenshots, free to use for articles, posters and festivals.';

/** [anglais, francais, espagnol] ; les plus longs d'abord quand l'un contient l'autre. */
const PAGE = [
  [TITLE_EN, 'Photos presse, logos et pochettes | Maudite Machine', 'Fotos de prensa, logos y portadas | Maudite Machine'],
  [DESC_EN, "Éléments presse de Maudite Machine : photos presse en haute résolution, logos, pochettes et captures de MM-STUDIO, libres d'utilisation pour les articles, affiches et festivals.", 'Material de prensa de Maudite Machine: fotos de prensa en alta resolución, logos, portadas y capturas de MM-STUDIO, de uso libre para artículos, carteles y festivales.'],
  ['Maudite Machine in the booth under a blue spotlight', 'Maudite Machine en cabine sous un projecteur bleu', 'Maudite Machine en la cabina bajo un foco azul'],
  ['"name": "Maudite Machine - Press assets"', '"name": "Maudite Machine - Éléments presse"', '"name": "Maudite Machine - Material de prensa"'],
  ['"description": "Press photos, logo, artwork, press kit and tech rider for Maudite Machine. Free to use for press and promoters."', "\"description\": \"Photos presse, logo, pochettes, press kit et fiche technique de Maudite Machine. Libres d'utilisation pour la presse et les organisateurs.\"", '"description": "Fotos de prensa, logo, portadas, press kit y rider técnico de Maudite Machine. De uso libre para prensa y promotores."'],
  ['<h1>Press assets</h1>', '<h1>Éléments presse</h1>', '<h1>Material de prensa</h1>'],
  ['Photos, logo, artwork, press kit and tech rider, edition 2027. Free to use for press, promoters and venues. Photo credit is welcome when the photographer is named in the file.', "Photos, logo, pochettes, press kit et fiche technique, édition 2027. Libres d'utilisation pour la presse, les organisateurs et les salles. Le crédit photo est bienvenu quand le photographe est nommé dans le fichier.", 'Fotos, logo, portadas, press kit y rider técnico, edición 2027. De uso libre para prensa, promotores y salas. El crédito fotográfico es bienvenido cuando el fotógrafo aparece en el archivo.'],
  ['Download everything', 'Tout télécharger', 'Descargar todo'],
  ['<span>ZIP · photos, logos, artwork, PDF</span>', '<span>ZIP · photos, logos, pochettes, PDF</span>', '<span>ZIP · fotos, logos, portadas, PDF</span>'],
  ['<span>PDF · EN · 6 pages</span>', '<span>PDF · EN · 6 pages</span>', '<span>PDF · EN · 6 páginas</span>'],
  ['>\n Tech Rider\n <span>', '>\n Fiche technique\n <span>', '>\n Rider técnico\n <span>'],
  ['<span class="label">The home page of mauditemachine.com</span>', "<span class=\"label\">La page d'accueil de mauditemachine.com</span>", '<span class="label">La página de inicio de mauditemachine.com</span>'],
  ['MM-STUDIO by Maudite Machine is a 3D studio played in the browser: the MM-RYTM drum machine, the MM-ARP synth and the MM-DECKS DJ decks and mixer, all in time. It is free, with no account and nothing to install. Mika designed and built the site and every machine on it.', 'MM-STUDIO par Maudite Machine est un studio en 3D qui se joue dans le navigateur : la boîte à rythmes MM-RYTM, le synthé MM-ARP, les platines et la table de mixage MM-DECKS, tous en rythme. C’est gratuit, sans compte et sans rien à installer. Mika a conçu et construit le site et chacune de ses machines.', 'MM-STUDIO de Maudite Machine es un estudio en 3D que se toca en el navegador: la caja de ritmos MM-RYTM, el sinte MM-ARP y los platos y la mesa de mezclas MM-DECKS, todo a tempo. Es gratis, sin cuenta y sin nada que instalar. Mika diseñó y construyó el sitio y cada una de sus máquinas.'],
  ['<dd>Drum machine: 8 voices (BD, SD, CH, OH, CP, TOM, HT, CY), 16 steps, parameter locks, 16 patterns, a SYNTH or SAMPLE layer per voice, voice and global effects</dd>', '<dd>Boîte à rythmes : 8 voix (BD, SD, CH, OH, CP, TOM, HT, CY), 16 pas, parameter locks, 16 patterns, une couche SYNTH ou SAMPLE par voix, effets par voix et globaux</dd>', '<dd>Caja de ritmos: 8 voces (BD, SD, CH, OH, CP, TOM, HT, CY), 16 pasos, parameter locks, 16 patrones, una capa SYNTH o SAMPLE por voz, efectos por voz y globales</dd>'],
  ['<dd>Synth: two oscillators and a sub, ladder filter with four modes, arpeggiator, 8 chord pads in F# minor, OVERDRIVE, CHORUS, DELAY, REVERB</dd>', "<dd>Synthé : deux oscillateurs et un sub, filtre ladder à quatre modes, arpégiateur, 8 pads d'accords en fa# mineur, OVERDRIVE, CHORUS, DELAY, REVERB</dd>", '<dd>Sinte: dos osciladores y un sub, filtro ladder de cuatro modos, arpegiador, 8 pads de acordes en fa# menor, OVERDRIVE, CHORUS, DELAY, REVERB</dd>'],
  ['<dd>Two to four DJ decks and a mixer (GAIN -12 to +12 dB, three band EQ, VU meters) that also takes MM-RYTM and MM-ARP, a sampler in each deck</dd>', '<dd>Deux à quatre platines et une table de mixage (GAIN de -12 à +12 dB, EQ trois bandes, vumètres) qui reçoit aussi MM-RYTM et MM-ARP, un sampler dans chaque platine</dd>', '<dd>De dos a cuatro platos y una mesa de mezclas (GAIN de -12 a +12 dB, EQ de tres bandas, vúmetros) que también recibe MM-RYTM y MM-ARP, un sampler en cada plato</dd>'],
  ['<dd>MIDI LEARN for every parameter; ready-made Melbourne Instruments Roto-Control setups, downloaded from the MIDI panel and imported in ROTO-SETUP, no MIDI LEARN needed</dd>', "<dd>MIDI LEARN pour chaque paramètre ; des setups prêts à l'emploi pour le Roto-Control de Melbourne Instruments, à télécharger depuis le panneau MIDI et à importer dans ROTO-SETUP, sans MIDI LEARN</dd>", '<dd>MIDI LEARN para cada parámetro; setups listos para el Roto-Control de Melbourne Instruments, que se descargan desde el panel MIDI y se importan en ROTO-SETUP, sin MIDI LEARN</dd>'],
  ['<dt class="label">Also</dt>', '<dt class="label">Aussi</dt>', '<dt class="label">Además</dt>'],
  ['<dd>UNDO and REDO, presets saved in the browser, Dark and Light appearances</dd>', '<dd>UNDO et REDO, presets gardés dans le navigateur, apparences sombre et claire</dd>', '<dd>UNDO y REDO, presets guardados en el navegador, apariencias oscura y clara</dd>'],
  ['<dt class="label">Runs on</dt>', '<dt class="label">Fonctionne sur</dt>', '<dt class="label">Funciona en</dt>'],
  ['<dd>Any browser with WebGL 2 and the Web Audio API, on a computer or a phone; Web MIDI in Chrome, Edge, Opera and Firefox</dd>', '<dd>Tout navigateur avec WebGL 2 et la Web Audio API, sur ordinateur ou téléphone ; Web MIDI dans Chrome, Edge, Opera et Firefox</dd>', '<dd>Cualquier navegador con WebGL 2 y la Web Audio API, en ordenador o móvil; Web MIDI en Chrome, Edge, Opera y Firefox</dd>'],
  ['<dt class="label">Built with</dt>', '<dt class="label">Construit avec</dt>', '<dt class="label">Hecho con</dt>'],
  ['<dt class="label">Design and build</dt>', '<dt class="label">Conception et réalisation</dt>', '<dt class="label">Diseño y desarrollo</dt>'],
  ['<a class="btn" href="/mm-studio/">\n About MM-STUDIO', '<a class="btn" href="/fr/mm-studio/">\n À propos de MM-STUDIO', '<a class="btn" href="/es/mm-studio/">\n Sobre MM-STUDIO'],
  ['Play MM-RYTM', 'Jouer le MM-RYTM', 'Tocar MM-RYTM'],
  ['Play MM-ARP', 'Jouer le MM-ARP', 'Tocar MM-ARP'],
  ['Play MM-DECKS', 'Jouer le MM-DECKS', 'Tocar MM-DECKS'],
  ['<span>Drum machine</span>', '<span>Boîte à rythmes</span>', '<span>Caja de ritmos</span>'],
  ['<span>Synth and arpeggiator</span>', '<span>Synthé et arpégiateur</span>', '<span>Sinte y arpegiador</span>'],
  ['<span>DJ decks and mixer</span>', '<span>Platines et table de mixage</span>', '<span>Platos y mesa de mezclas</span>'],
  ['alt="MM-STUDIO: MM-RYTM, MM-ARP and MM-DECKS side by side in 3D"', 'alt="MM-STUDIO : MM-RYTM, MM-ARP et MM-DECKS côte à côte en 3D"', 'alt="MM-STUDIO: MM-RYTM, MM-ARP y MM-DECKS uno al lado del otro en 3D"'],
  ['alt="The MM-RYTM drum machine of MM-STUDIO"', 'alt="La boîte à rythmes MM-RYTM de MM-STUDIO"', 'alt="La caja de ritmos MM-RYTM de MM-STUDIO"'],
  ['alt="The MM-ARP synth of MM-STUDIO"', 'alt="Le synthé MM-ARP de MM-STUDIO"', 'alt="El sinte MM-ARP de MM-STUDIO"'],
  ['alt="MM-STUDIO, the three machines, share image"', 'alt="MM-STUDIO, les trois machines, image de partage"', 'alt="MM-STUDIO, las tres máquinas, imagen para compartir"'],
  ['<span class="label">MM-STUDIO · Overview</span>', "<span class=\"label\">MM-STUDIO · Vue d'ensemble</span>", '<span class="label">MM-STUDIO · Vista general</span>'],
  ['<span class="label">Share image</span>', '<span class="label">Image de partage</span>', '<span class="label">Imagen para compartir</span>'],
  ['<h2>Press photos</h2>', '<h2>Photos presse</h2>', '<h2>Fotos de prensa</h2>'],
  ['<span class="label">9 files · JPG</span>', '<span class="label">9 fichiers · JPG</span>', '<span class="label">9 archivos · JPG</span>'],
  ['alt="Maudite Machine at the decks, green stage light, colour"', 'alt="Maudite Machine aux platines, lumière de scène verte, couleur"', 'alt="Maudite Machine en los platos, luz de escenario verde, color"'],
  ['alt="Maudite Machine playing to a crowd, wide shot"', 'alt="Maudite Machine devant le public, plan large"', 'alt="Maudite Machine tocando ante el público, plano general"'],
  ['alt="Maudite Machine, black and white portrait"', 'alt="Maudite Machine, portrait noir et blanc"', 'alt="Maudite Machine, retrato en blanco y negro"'],
  ['alt="Maudite Machine, black and white press photo"', 'alt="Maudite Machine, photo presse noir et blanc"', 'alt="Maudite Machine, foto de prensa en blanco y negro"'],
  ['alt="Maudite Machine, wide black and white press photo"', 'alt="Maudite Machine, photo presse large en noir et blanc"', 'alt="Maudite Machine, foto de prensa panorámica en blanco y negro"'],
  ['alt="Maudite Machine, colour press photo"', 'alt="Maudite Machine, photo presse en couleur"', 'alt="Maudite Machine, foto de prensa en color"'],
  ['<span class="label">Colour, A4</span>', '<span class="label">Couleur, A4</span>', '<span class="label">Color, A4</span>'],
  ['<span class="label">2027 · Booth</span>', '<span class="label">2027 · Cabine</span>', '<span class="label">2027 · Cabina</span>'],
  ['<span class="label">Colour</span>', '<span class="label">Couleur</span>', '<span class="label">Color</span>'],
  ['<span class="label">2027 · Crowd</span>', '<span class="label">2027 · Public</span>', '<span class="label">2027 · Público</span>'],
  ['<span class="label">Colour wide</span>', '<span class="label">Couleur, large</span>', '<span class="label">Color, panorámica</span>'],
  ['<span class="label">2027 · Portrait</span>', '<span class="label">2027 · Portrait</span>', '<span class="label">2027 · Retrato</span>'],
  ['<span class="label">B&amp;W wide</span>', '<span class="label">N&amp;B, large</span>', '<span class="label">B/N, panorámica</span>'],
  ['<span class="label">B&amp;W</span>', '<span class="label">N&amp;B</span>', '<span class="label">B/N</span>'],
  ['<span class="label">Press 01</span>', '<span class="label">Presse 01</span>', '<span class="label">Prensa 01</span>'],
  ['<span class="label">Press 02</span>', '<span class="label">Presse 02</span>', '<span class="label">Prensa 02</span>'],
  ['<span class="label">Press 03</span>', '<span class="label">Presse 03</span>', '<span class="label">Prensa 03</span>'],
  ['<span class="label">Press 04</span>', '<span class="label">Presse 04</span>', '<span class="label">Prensa 04</span>'],
  ['<span class="label">Press 05</span>', '<span class="label">Presse 05</span>', '<span class="label">Prensa 05</span>'],
  ['<span class="label">6 files · SVG, PNG</span>', '<span class="label">6 fichiers · SVG, PNG</span>', '<span class="label">6 archivos · SVG, PNG</span>'],
  ['alt="Maudite Machine logo, white"', 'alt="Logo Maudite Machine, blanc"', 'alt="Logo de Maudite Machine, blanco"'],
  ['alt="Maudite Machine logo, white, vector"', 'alt="Logo Maudite Machine, blanc, vectoriel"', 'alt="Logo de Maudite Machine, blanco, vectorial"'],
  ['alt="Maudite Machine logo, dark grey, vector"', 'alt="Logo Maudite Machine, gris foncé, vectoriel"', 'alt="Logo de Maudite Machine, gris oscuro, vectorial"'],
  ['alt="Maudite Machine logo, yellow, vector"', 'alt="Logo Maudite Machine, jaune, vectoriel"', 'alt="Logo de Maudite Machine, amarillo, vectorial"'],
  ['alt="Maudite Machine A mark, white, vector"', 'alt="Monogramme A de Maudite Machine, blanc, vectoriel"', 'alt="Monograma A de Maudite Machine, blanco, vectorial"'],
  ['alt="Maudite Machine logo on one line, yellow"', 'alt="Logo Maudite Machine sur une ligne, jaune"', 'alt="Logo de Maudite Machine en una línea, amarillo"'],
  ['<span class="label">Logo · white</span>', '<span class="label">Logo · blanc</span>', '<span class="label">Logo · blanco</span>'],
  ['<span class="label">PNG · dark backgrounds</span>', '<span class="label">PNG · fonds sombres</span>', '<span class="label">PNG · fondos oscuros</span>'],
  ['<span class="label">SVG · dark backgrounds</span>', '<span class="label">SVG · fonds sombres</span>', '<span class="label">SVG · fondos oscuros</span>'],
  ['<span class="label">Logo · ink</span>', '<span class="label">Logo · encre</span>', '<span class="label">Logo · tinta</span>'],
  ['<span class="label">SVG · light backgrounds</span>', '<span class="label">SVG · fonds clairs</span>', '<span class="label">SVG · fondos claros</span>'],
  ['<span class="label">Logo · yellow</span>', '<span class="label">Logo · jaune</span>', '<span class="label">Logo · amarillo</span>'],
  ['<span class="label">A mark · white</span>', '<span class="label">Monogramme A · blanc</span>', '<span class="label">Monograma A · blanco</span>'],
  ['<span class="label">One line · yellow</span>', '<span class="label">Une ligne · jaune</span>', '<span class="label">Una línea · amarillo</span>'],
  ['<h2>Artwork</h2>', '<h2>Pochettes</h2>', '<h2>Portadas</h2>'],
  ['<span class="label">13 files · WEBP</span>', '<span class="label">13 fichiers · WEBP</span>', '<span class="label">13 archivos · WEBP</span>'],
  ["', artwork\" loading", "', pochette\" loading", "', portada\" loading"],
];

/** Les adresses et la langue de la page (balises entieres : les images de /press/ gardent leur adresse). */
function headOf(lang) {
  const url = `${SITE}${PATH[lang]}`;
  const loc = { en: 'en_GB', fr: 'fr_FR', es: 'es_ES' };
  const others = LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${loc[l]}" />`).join('\n    ');
  const crumb = { fr: 'Éléments presse', es: 'Material de prensa' }[lang];
  return [
    ['<html lang="en">', `<html lang="${lang}">`],
    [`<link rel="canonical" href="${SITE}/press/" />`, `<link rel="canonical" href="${url}" />`],
    [`<meta property="og:url" content="${SITE}/press/" />`, `<meta property="og:url" content="${url}" />`],
    ['<meta property="og:locale" content="en_GB" />\n <meta property="og:locale:alternate" content="fr_FR" />\n <meta property="og:locale:alternate" content="es_ES" />', `<meta property="og:locale" content="${loc[lang]}" />\n    ${others}`],
    [`"@id": "${SITE}/press/#page"`, `"@id": "${url}#page"`],
    [`"url": "${SITE}/press/",`, `"url": "${url}",`],
    [`"name": "Maudite Machine", "item": "${SITE}/" }`, `"name": "Maudite Machine", "item": "${SITE}/${lang}/" }`],
    [`"name": "Press assets", "item": "${SITE}/press/" }`, `"name": "${crumb}", "item": "${url}" }`],
  ];
}

/** Un texte anglais exact en motif : les blancs (espaces, retours, indentation) comptent pour un. */
const pattern = (en) => new RegExp(en.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');

function translate(html, lang) {
  const col = lang === 'fr' ? 1 : 2;
  const missing = [];
  let out = html;
  for (const [en, fr] of headOf(lang)) {
    const re = pattern(en);
    if (!re.test(out)) missing.push(en);
    out = out.replace(pattern(en), fr.replace(/\$/g, '$$$$'));
  }
  // les plus longs d'abord : un texte qui en contient un autre passe avant lui
  const rows = [...PAGE].sort((a, b) => b[0].length - a[0].length);
  for (const row of rows) {
    const re = pattern(row[0]);
    if (!re.test(out)) {
      missing.push(row[0]);
      continue;
    }
    out = out.replace(pattern(row[0]), row[col].replace(/\$/g, '$$$$'));
  }
  if (missing.length) console.warn(`press-pages (${lang}) : ${missing.length} texte(s) anglais introuvable(s) dans la page :\n  ${missing.map((m) => m.slice(0, 90)).join('\n  ')}`);
  return out;
}

/* ---------------- les deux modes ---------------- */

function writePublic() {
  const html = readFileSync(PUBLIC_PAGE, 'utf8');
  const next = withBlocks(html, 'en');
  if (next !== html) writeFileSync(PUBLIC_PAGE, next, 'utf8');
  console.log(`press-pages : public/press/index.html ${next === html ? 'deja a jour' : 'reecrite'} (section Bio, choix de langue)`);
}

function writeDist() {
  const enPath = join(DIST, 'press', 'index.html');
  if (!existsSync(enPath)) {
    console.warn('press-pages : pas de dist/press/index.html (lance le build d abord) ; rien a faire');
    return;
  }
  const src = readFileSync(PUBLIC_PAGE, 'utf8');
  if (withBlocks(src, 'en') !== src) console.warn('press-pages : la section Bio de public/press/index.html differe de src/data/pressBio.json ; node scripts/press-pages.mjs --public la remet a jour');
  const en = withBlocks(readFileSync(enPath, 'utf8'), 'en');
  writeFileSync(enPath, en, 'utf8');
  for (const lang of ['fr', 'es']) {
    const dir = join(DIST, lang, 'press');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), translate(withBlocks(en, lang), lang), 'utf8');
  }
  console.log('press-pages : dist/press, dist/fr/press et dist/es/press ecrites (section Bio)');
}

if (!BIO || !BIO.en || !BIO.fr || !BIO.es || !Array.isArray(BIO.instagram)) {
  console.warn('press-pages : src/data/pressBio.json illisible ; rien a faire');
} else if (process.argv.includes('--public')) {
  writePublic();
} else {
  writeDist();
}
