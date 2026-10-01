#!/usr/bin/env node
/**
 * Press kit 2027, revision 2 : six pages A4, anglais seulement :
 *   public/Presskit_Maudite_Machine_2027.pdf          bandeau Boom Festival 2027
 *   public/Presskit_Maudite_Machine_2027_generic.pdf  sans le bandeau
 *   public/press/pages/presskit-2027-01.webp a 06     pages en image (visionneuse /presskit)
 *   src/v4/data/presskit.ts                           pages et liens de la visionneuse
 * Copie de la version neutre a l'ancienne adresse deja envoyee :
 * public/Presskit_Maudite_Machine_2026-27.pdf.
 * Fiche technique, 2 pages, memes donnees et meme style :
 *   public/Tech_Rider_Maudite_Machine_2026-27.pdf  (adresse gardee : liens deja envoyes)
 *
 * Gabarit en HTML genere depuis content.mjs, styles dans presskit.css,
 * rendu par Google Chrome sans tete : chaque <a href> devient un lien
 * cliquable du PDF. Pages en image par pdftoppm et cwebp (Homebrew :
 * poppler, webp). Aucune dependance npm.
 * Usage : node docs/presskit-2027/build.mjs
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { C, URL } from './content.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PUB = join(ROOT, 'public');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGES = 6;

const VARIANTS = [
  { out: 'Presskit_Maudite_Machine_2027.pdf', banner: 'Boom Festival 2027 · Alchemy Circle', boom: true, images: false },
  { out: 'Presskit_Maudite_Machine_2027_generic.pdf', banner: '', boom: false, images: true },
];
const COPIES = ['Presskit_Maudite_Machine_2026-27.pdf'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const a = (text, href) => `<a href="${esc(href)}">${esc(text)}</a>`;
const title = (t) => `<h2 class="st">${esc(t)}</h2>`;
const folio = (n) => `<footer class="folio"><span>${esc(C.folio)}</span><span>${n} / ${PAGES}</span></footer>`;

/** Ligne de fiche : le libelle avant les deux-points en gras. */
const items = (list) =>
  `<ul class="items">${list
    .map((i) => {
      const m = /^([^:]{2,40}?):(.*)$/.exec(i);
      return m ? `<li><b>${esc(m[1])}:</b>${esc(m[2])}</li>` : `<li>${esc(i)}</li>`;
    })
    .join('')}</ul>`;

const perf = (rows) => `<ul class="perf">${rows.map(([n, y]) => `<li><span>${esc(n)}</span><span>${esc(y)}</span></li>`).join('')}</ul>`;

function pages(v) {
  const out = [];
  const img = (cls, file, alt = '') => `<img class="${cls}" src="img/${file}" alt="${esc(alt)}">`;

  // 1. Couverture : la salle pleine, le nom, le positionnement, le bandeau Boom
  out.push(`
<section class="page p1">
  ${img('cover', 'p1-stage-crowd.jpg')}
  <div class="meta"><span class="sub">${esc(C.kit)}</span>${v.banner ? `<span class="sub boom">${esc(v.banner)}</span>` : ''}</div>
  <h1>${esc(C.name)}</h1>
  <p class="pos">${esc(C.positioning)}</p>
  <p class="bio">${esc(C.bio)}</p>
  <dl class="facts">${C.facts.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
  <p class="p1-links">${a('mauditemachine.com', URL.site)}<span>·</span>${a('mauditemachine.com/press', URL.press)}<span>·</span>${a(C.mix.text, C.mix.url)}</p>
  ${folio(1)}
</section>`);

  // 2. Parcours : le portrait couleur, la bio, les quatre chiffres cles
  out.push(`
<section class="page p2">
  ${title(C.bioTitle)}
  <div class="p2-top">
    ${img('portrait', 'p2-portrait.jpg')}
    <div class="main">
      <p class="lead">${esc(C.bioLead)}</p>
      ${C.bioLong.map((p) => `<p class="para">${esc(p)}</p>`).join('')}
    </div>
  </div>
  <div class="stats">${C.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
  <div class="shared">
    <p class="sub">${esc(C.sharedTitle)}</p>
    <p>${C.shared.map(esc).join(' · ')}</p>
  </div>
  ${img('wide', 'p2-wide.jpg')}
  ${folio(2)}
</section>`);

  // 3. Le son : la cabine en grand, ce qu'il joue, les deux formats
  out.push(`
<section class="page p3">
  ${img('hero', 'p3-booth.jpg')}
  ${title(C.setTitle)}
  <div class="p3-grid">
    <div class="rows">
      ${C.set
        .map(([h, ps], k) => {
          const last = k === C.set.length - 1;
          const body = ps.map((p, q) => `<p>${esc(p)}${last && v.boom && q === ps.length - 1 ? ` ${esc(C.boom)}` : ''}</p>`).join('');
          return `<div class="row"><p class="sub">${esc(h)}</p><div>${body}</div></div>`;
        })
        .join('')}
    </div>
    <div class="formats">
      <figure>${img('fmt', 'p3-dj.jpg')}<figcaption>DJ set</figcaption></figure>
      <figure>${img('fmt', 'p3-live.jpg')}<figcaption>Hybrid live</figcaption></figure>
    </div>
  </div>
  <div class="edits">
    <p class="sub">${esc(C.editsTitle)}</p>
    <p>${C.edits.map(esc).join(' · ')}</p>
    <p class="muted small">${esc(C.editsNote)}</p>
  </div>
  ${folio(3)}
</section>`);

  // 4. Dates : la foule vue de la cabine, les scenes, les plateaux, le label
  out.push(`
<section class="page shows">
  ${img('banner', 'p4-crowd.jpg')}
  ${title(C.perfTitle)}
  <div class="cols2">
    <div><p class="sub">${esc(C.festivalsTitle)}</p>${perf(C.festivals)}</div>
    <div><p class="sub">${esc(C.venuesTitle)}</p>${perf(C.venues)}</div>
  </div>
  <p class="rooms">${esc(C.rooms)}</p>
  <div class="label">
    <div><p class="sub">${esc(C.labelTitle)}</p><p>${esc(C.labelText)} ${a('vrstlrecords.com', URL.vrstl)}</p></div>
    <div><p class="sub">${esc(C.rosterTitle)}</p><p>${C.roster.map(esc).join(' · ')}</p></div>
  </div>
  <div class="strip">${img('', 'p4-day.jpg')}${img('', 'p4-flare.jpg')}</div>
  ${folio(4)}
</section>`);

  // 5. Ecoute : la cabine sous le faisceau, le mix, les titres, les pochettes
  out.push(`
<section class="page listen">
  ${img('hero5', 'p5-booth.jpg')}
  ${title(C.listenTitle)}
  <p class="mix">${a(C.mix.text, C.mix.url)}<span class="muted"> · ${esc(C.mix.meta)}</span></p>
  <ul class="tracks">${C.tracks.map(([n, meta, url]) => `<li>${a(n, url)}<span class="muted">${esc(meta)}</span></li>`).join('')}</ul>
  <p class="platforms"><span class="muted">${esc(C.listenIntro)}</span>${C.platforms.map(([n, url]) => a(n, url)).join('')}</p>
  ${title(C.discoTitle)}
  <div class="limbos">
    <p>${a(C.limbos.text, URL.limbosAlbum)}<span class="muted"> · ${esc(C.limbos.meta)}</span></p>
    <p class="about">${esc(C.limbos.about)}</p>
    <ol class="tracklist">${C.tracklist.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
  </div>
  <p class="sub cat-title">${esc(C.catalogueTitle)}</p>
  <ul class="covers">${C.catalogue
    .map(([t, type, d]) => `<li>${img('', `cover-${t.toLowerCase().replace(/[^a-z]/g, '')}.jpg`)}<b>${esc(t)}</b><span class="muted">${esc(type)} · ${esc(d)}</span></li>`)
    .join('')}</ul>
  <p class="also">${esc(C.also)}</p>
  ${folio(5)}
</section>`);

  // 6. Technique et contact, le portrait noir et blanc en vignette
  out.push(`
<section class="page p4">
  ${title(C.techTitle)}
  <p class="intro">${esc(C.techIntro)}</p>
  <div class="flow tech">
    ${C.tech.map(([h, list]) => `<div><p class="sub">${esc(h)}</p>${items(list)}</div>`).join('')}
  </div>
  ${title(C.hospTitle)}
  <div class="flow hosp">
    ${C.hosp.map(([h, list]) => `<div><p class="sub">${esc(h)}</p>${items(list)}</div>`).join('')}
  </div>
  ${title(C.contactTitle)}
  <div class="who with-photo">
    ${img('thumb', 'p6-portrait-bw.jpg')}
    ${C.contacts.map(([h, name, lines]) => `<div><p class="sub">${esc(h)}</p><p class="name">${esc(name)}</p>${lines.map(([t, href]) => `<p>${a(t, href)}</p>`).join('')}</div>`).join('')}
  </div>
  <div class="links">
    <p class="sub">${esc(C.linksTitle)}</p>
    <p class="link-row">${C.links.map(([t, href]) => a(t, href)).join('')}</p>
  </div>
  <div class="assets">
    ${C.assets.map(([t, href, note]) => `<p>${a(t, href)}${note ? `<span class="muted"> · ${esc(note)}</span>` : ''}</p>`).join('')}
  </div>
  <p class="copy">${esc(C.copyright)}</p>
  ${folio(6)}
</section>`);

  return out.join('\n');
}

/** Fiche technique : 2 pages, la fiche, le plan de scene, l'accueil et les contacts. */
function riderPages() {
  const [dj, live, length, plot] = C.tech;
  const head = (n) => `<div class="r-head"><p class="r-name">${esc(C.name)}</p><p class="sub">Tech rider 2027 \u00b7 ${n} / 2</p></div>`;
  const rfolio = (n) => `<footer class="folio"><span>Maudite Machine \u00b7 Tech rider 2027</span><span>${n} / 2</span></footer>`;
  return `
<section class="page p4 rider">
  ${head(1)}
  ${title(C.techTitle)}
  <p class="intro">${esc(C.techIntro)}</p>
  <div class="flow tech">
    ${[dj, live, length].map(([h, list]) => `<div><p class="sub">${esc(h)}</p>${items(list)}</div>`).join('')}
  </div>
  ${title(plot[0])}
  <div class="stage">
    <div class="mon l"><b>Monitor L</b><span>12" or 15" + horn</span></div>
    <div class="dj">2 x CDJ + DJM<span>optional, transitions</span></div>
    <div class="artist">Artist, facing the audience</div>
    <div class="table">
      <div class="gear"><span>Push 3</span><span>APC40</span><span class="mac">MacBook Pro<br>Ableton Live</span><span>Typhon<br>Dreadbox</span></div>
      <div class="iface">Audio interface</div>
      <p>Table 180 x 70 cm \u00b7 90 to 100 cm high \u00b7 4 x power</p>
    </div>
    <div class="di">2 x DI \u00b7 L/R XLR to FOH</div>
    <div class="mon r"><b>Monitor R</b><span>12" or 15" + horn</span></div>
    <div class="aud">Audience</div>
  </div>
  <p class="note">${esc(plot[1][1])}</p>
  ${rfolio(1)}
</section>
<section class="page p4 rider">
  ${head(2)}
  ${title(C.hospTitle)}
  <div class="flow hosp">
    ${C.hosp.map(([h, list]) => `<div><p class="sub">${esc(h)}</p>${items(list)}</div>`).join('')}
  </div>
  ${title(C.contactTitle)}
  <div class="who">
    ${C.contacts.map(([h, name, lines]) => `<div><p class="sub">${esc(h)}</p><p class="name">${esc(name)}</p>${lines.map(([t, href]) => `<p>${a(t, href)}</p>`).join('')}</div>`).join('')}
  </div>
  <div class="links">
    <p class="sub">${esc(C.linksTitle)}</p>
    <p class="link-row">${C.links.map(([t, href]) => a(t, href)).join('')}</p>
  </div>
  <div class="assets">
    <p>${a('Press kit 2027 (PDF)', URL.site + 'Presskit_Maudite_Machine_2027_generic.pdf')}<span class="muted"> \u00b7 </span>${a(C.assets[0][0], C.assets[0][1])}<span class="muted"> \u00b7 ${esc(C.assets[0][2])}</span></p>
  </div>
  <p class="copy">${esc(C.copyright)}</p>
  ${rfolio(2)}
</section>`;
}

const html = (v) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Maudite Machine, ${esc(C.kit)}</title>
<link rel="stylesheet" href="presskit.css">
</head>
<body>
${v.rider ? riderPages() : pages(v)}
</body>
</html>
`;

function render(v, pdf) {
  const tmp = join(HERE, `.render-${v.rider ? 'rider' : v.boom ? 'boom' : 'generic'}.html`);
  writeFileSync(tmp, html(v));
  try {
    execFileSync(
      CHROME,
      ['--headless', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', '--virtual-time-budget=20000', `--print-to-pdf=${pdf}`, pathToFileURL(tmp).href],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
  } finally {
    rmSync(tmp, { force: true });
  }
}

/**
 * Pages en WebP pour la visionneuse du site (/presskit) : qualite 80,
 * 1400 px de large ; si les six pesent plus de 900 Ko, 1200 px d'abord,
 * puis la qualite par pas de 2 (la largeur baisse avant la qualite).
 * public/press/pages/presskit-2027-NN.webp.
 */
const PAGE_DIR = join(PUB, 'press', 'pages');
const PAGE_BUDGET = 900 * 1024;
function images(pdf) {
  rmSync(join(PUB, 'press', 'kit-2027'), { recursive: true, force: true });
  rmSync(PAGE_DIR, { recursive: true, force: true });
  mkdirSync(PAGE_DIR, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'mm-kit-'));
  try {
    // 1400 px en qualite 80, sinon 1200 px, et seulement ensuite la qualite qui baisse
    for (const [width, q] of [
      [1400, 80],
      [1200, 80],
      [1200, 78],
      [1200, 76],
      [1200, 74],
    ]) {
      for (const f of readdirSync(work)) rmSync(join(work, f));
      execFileSync('pdftoppm', ['-png', '-scale-to-x', String(width), '-scale-to-y', '-1', pdf, join(work, 'p')]);
      const files = readdirSync(work).filter((f) => f.endsWith('.png')).sort();
      let total = 0;
      const out = files.map((f, k) => {
        const name = `presskit-2027-${String(k + 1).padStart(2, '0')}.webp`;
        execFileSync('cwebp', ['-quiet', '-q', String(q), join(work, f), '-o', join(PAGE_DIR, name)]);
        const size = statSync(join(PAGE_DIR, name)).size;
        total += size;
        return { name, size };
      });
      const h = Math.round((width * 297) / 210);
      if (total <= PAGE_BUDGET) return { width, q, height: h, total, out };
    }
    throw new Error('pages en WebP : plus de 900 Ko meme a 1200 px et qualite 74');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Toutes les adresses d'un gabarit (les liens du PDF), dans l'ordre, sans doublon. */
const hrefs = (h) => [...new Set([...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((u) => u !== 'presskit.css'))];

/**
 * Les liens de la visionneuse (sous la derniere page) : exactement les
 * destinations du PDF, rangees par groupe. Verifie : la meme liste, ni un
 * de plus ni un de moins.
 */
function viewerLinks(generic) {
  const groups = [
    ['Listen', [[C.mix.text, C.mix.url], ...C.tracks.map(([n, , u]) => [n, u]), [C.limbos.text, URL.limbosAlbum], ...C.platforms]],
    ['Site and documents', [['mauditemachine.com', URL.site], ...C.assets.map(([t, u]) => [t, u]), ['vrstlrecords.com', URL.vrstl]]],
    ['Contact', C.contacts.flatMap(([, name, lines]) => lines.map(([t, u]) => [`${name}: ${t}`, u]))],
    ['Links', C.links],
  ];
  const seen = new Set();
  const out = groups.map(([g, list]) => [g, list.filter(([, u]) => (seen.has(u) ? false : (seen.add(u), true)))]);
  const want = new Set(hrefs(generic));
  const missing = [...want].filter((u) => !seen.has(u));
  const extra = [...seen].filter((u) => !want.has(u));
  if (missing.length || extra.length) throw new Error(`liens de la visionneuse : manquants ${missing.join(' ')} ; en trop ${extra.join(' ')}`);
  return out;
}

const SECTIONS = ['Cover', 'Background', 'The sound', 'Selected shows', 'Listen', 'Technical and contact'];

for (const v of VARIANTS) {
  const pdf = join(PUB, v.out);
  render(v, pdf);
  const bytes = statSync(pdf).size;
  const mb = bytes / 1024 / 1024;
  console.log(`${v.out}  ${mb.toFixed(2)} Mo`);
  if (mb >= 8) {
    console.error('Plus de 8 Mo : alleger les images de img/.');
    process.exitCode = 1;
  }
  if (!v.images) continue;
  const pg = images(pdf);
  console.log(`  ${pg.out.length} pages en WebP, ${pg.width} px, qualite ${pg.q} : ${pg.out.map((o) => `${Math.round(o.size / 1024)} Ko`).join(', ')} (total ${Math.round(pg.total / 1024)} Ko)`);
  // Donnees de la visionneuse, generees : pages, liens, poids du PDF
  const links = viewerLinks(html(v));
  const ts = `/**
 * GENERE par docs/presskit-2027/build.mjs : ne pas editer a la main.
 * Le press kit 2027 pour la visionneuse du site (/presskit) : les pages en
 * WebP, leur titre de section (alt), le PDF et ses liens (les memes
 * destinations que le PDF, rangees par groupe).
 */

export const KIT = {
  title: 'Press kit 2027',
  pdf: '/${v.out}',
  size: '${mb.toFixed(1)} MB',
  w: ${pg.width},
  h: ${pg.height},
  pages: ${JSON.stringify(pg.out.map((o, k) => ({ src: `/press/pages/${o.name}`, section: SECTIONS[k] })), null, 2).replace(/"(\w+)":/g, '$1:')},
} as const;

export const KIT_LINKS: readonly (readonly [string, readonly (readonly [string, string])[]])[] = ${JSON.stringify(links, null, 2)};
`;
  writeFileSync(join(ROOT, 'src', 'v4', 'data', 'presskit.ts'), ts);
  console.log(`  src/v4/data/presskit.ts : ${links.reduce((n, [, l]) => n + l.length, 0)} liens`);
}
for (const c of COPIES) copyFileSync(join(PUB, 'Presskit_Maudite_Machine_2027_generic.pdf'), join(PUB, c));
console.log(`copie : ${COPIES.join(', ')}`);

// Fiche technique (2 pages) a son adresse d'origine
const RIDER = 'Tech_Rider_Maudite_Machine_2026-27.pdf';
render({ rider: true }, join(PUB, RIDER));
console.log(`${RIDER}  ${(statSync(join(PUB, RIDER)).size / 1024 / 1024).toFixed(2)} Mo`);
