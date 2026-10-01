#!/usr/bin/env node
/**
 * Press kit 2027, version 4 pages A4, anglais seulement :
 *   public/Presskit_Maudite_Machine_2027.pdf          bandeau Boom Festival 2027
 *   public/Presskit_Maudite_Machine_2027_generic.pdf  sans le bandeau
 *   public/press/kit-2027/01.webp a 04.webp           pages en image (popup du site)
 * Copie de la version neutre a l'ancienne adresse deja envoyee :
 * public/Presskit_Maudite_Machine_2026-27.pdf.
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
const PAGES = 4;

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

  // 1. Couverture et identite
  out.push(`
<section class="page p1">
  <img class="banner-cover" src="img/banner-cover.jpg" alt="">
  <div class="meta"><span class="sub">${esc(C.kit)}</span>${v.banner ? `<span class="sub boom">${esc(v.banner)}</span>` : ''}</div>
  <h1>${esc(C.name)}</h1>
  <p class="pos">${esc(C.positioning)}</p>
  <p class="bio">${esc(C.bio)}</p>
  <div class="stats">${C.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
  <dl class="facts">${C.facts.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
  <p class="p1-links">${a('mauditemachine.com', URL.site)}<span>·</span>${a('mauditemachine.com/press', URL.press)}<span>·</span>${a(C.mix.text, C.mix.url)}</p>
  ${folio(1)}
</section>`);

  // 2. Parcours et preuves
  out.push(`
<section class="page p2">
  ${title(C.bioTitle)}
  <div class="p2-top">
    <img class="portrait" src="img/portrait.jpg" alt="">
    <div class="main">
      <p class="lead">${esc(C.bioLead)}</p>
      ${C.bioLong.map((p) => `<p class="para">${esc(p)}</p>`).join('')}
    </div>
  </div>
  <div class="shared">
    <p class="sub">${esc(C.sharedTitle)}</p>
    <p>${C.shared.map(esc).join(' \u00b7 ')}</p>
  </div>
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
  ${folio(2)}
</section>`);

  // 3. Le son et l'ecoute
  out.push(`
<section class="page p3">
  <img class="banner-crowd" src="img/banner-crowd.jpg" alt="">
  ${title(C.setTitle)}
  <div class="rows">
    ${C.set
      .map(([h, ps], k) => {
        const last = k === C.set.length - 1;
        const body = ps.map((p, q) => `<p>${esc(p)}${last && v.boom && q === ps.length - 1 ? ` ${esc(C.boom)}` : ''}</p>`).join('');
        return `<div class="row"><p class="sub">${esc(h)}</p><div>${body}</div></div>`;
      })
      .join('')}
  </div>
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
  <ul class="catalogue">${C.catalogue.map(([t, type, d]) => `<li><b>${esc(t)}</b><span class="muted">${esc(type)} · ${esc(d)}</span></li>`).join('')}</ul>
  <p class="also">${esc(C.also)}</p>
  <div class="edits">
    <p class="sub">${esc(C.editsTitle)}</p>
    <p>${C.edits.map(esc).join(' · ')}</p>
    <p class="muted small">${esc(C.editsNote)}</p>
  </div>
  ${folio(3)}
</section>`);

  // 4. Technique et contact
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
  <div class="who">
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
  ${folio(4)}
</section>`);

  return out.join('\n');
}

const html = (v) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Maudite Machine, ${esc(C.kit)}</title>
<link rel="stylesheet" href="presskit.css">
</head>
<body>
${pages(v)}
</body>
</html>
`;

function render(v, pdf) {
  const tmp = join(HERE, `.render-${v.boom ? 'boom' : 'generic'}.html`);
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

/** Pages en WebP (1240 px de large, 150 ppp) pour le popup du site. */
function images(pdf) {
  const dir = join(PUB, 'press', 'kit-2027');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'mm-kit-'));
  try {
    execFileSync('pdftoppm', ['-r', '150', '-png', pdf, join(work, 'p')]);
    const files = readdirSync(work).filter((f) => f.endsWith('.png')).sort();
    files.forEach((f, k) => {
      execFileSync('cwebp', ['-quiet', '-q', '82', join(work, f), '-o', join(dir, `${String(k + 1).padStart(2, '0')}.webp`)]);
    });
    return files.length;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

for (const v of VARIANTS) {
  const pdf = join(PUB, v.out);
  render(v, pdf);
  const mb = statSync(pdf).size / 1024 / 1024;
  const n = v.images ? `, ${images(pdf)} pages en image` : '';
  console.log(`${v.out}  ${mb.toFixed(2)} Mo${n}`);
  if (mb >= 5) {
    console.error('Plus de 5 Mo : alleger les images de img/.');
    process.exitCode = 1;
  }
}
for (const c of COPIES) copyFileSync(join(PUB, 'Presskit_Maudite_Machine_2027_generic.pdf'), join(PUB, c));
console.log(`copie : ${COPIES.join(', ')}`);
