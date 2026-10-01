#!/usr/bin/env node
/**
 * Press kit 2027 (10 pages A4) en anglais, francais et espagnol :
 *   public/Presskit_Maudite_Machine_2027.pdf       anglais, bandeau Boom Festival
 *   public/Presskit_Maudite_Machine_2027_EN.pdf    anglais, neutre
 *   public/Presskit_Maudite_Machine_2027_FR.pdf    francais
 *   public/Presskit_Maudite_Machine_2027_ES.pdf    espagnol
 *   public/press/kit-2027/{en,fr,es}/NN.webp       pages en image (popup du site)
 * Copies de la version anglaise neutre aux anciennes adresses (liens deja
 * envoyes) : Presskit_Maudite_Machine_2027_generic.pdf et
 * Presskit_Maudite_Machine_2026-27.pdf.
 *
 * Gabarit en HTML genere depuis content.mjs, styles dans presskit.css,
 * rendu par Google Chrome sans tete ; pages en image par pdftoppm et
 * cwebp (Homebrew : poppler, webp). Aucune dependance npm.
 * Usage : node docs/presskit-2027/build.mjs
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SHARED, T } from './content.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PUB = join(ROOT, 'public');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGES = 10;

const VARIANTS = [
  { out: 'Presskit_Maudite_Machine_2027.pdf', lang: 'en', banner: 'Boom Festival 2027 · Alchemy Circle', boom: true, images: false },
  { out: 'Presskit_Maudite_Machine_2027_EN.pdf', lang: 'en', banner: '', boom: false, images: true },
  { out: 'Presskit_Maudite_Machine_2027_FR.pdf', lang: 'fr', banner: '', boom: false, images: true },
  { out: 'Presskit_Maudite_Machine_2027_ES.pdf', lang: 'es', banner: '', boom: false, images: true },
];
const COPIES = ['Presskit_Maudite_Machine_2027_generic.pdf', 'Presskit_Maudite_Machine_2026-27.pdf'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad2 = (n) => String(n).padStart(2, '0');

/** En-tete de page : numero, titre, mention. */
const head = (n, title, kicker = '') => `
  <header class="head">
    <div><span class="num">${pad2(n)}</span><h2>${esc(title)}</h2></div>
    ${kicker ? `<span class="kicker">${esc(kicker)}</span>` : ''}
  </header>`;

const folio = (t, n) => `<footer class="folio"><span>${esc(t.folio)}</span><span>${pad2(n)} / ${pad2(PAGES)}</span></footer>`;

const list = (items) => `<ul class="items">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

/** Libelle avant les deux-points d'une ligne de fiche technique, en gras. */
const rider = (items) =>
  `<ul class="items rider">${items
    .map((i) => {
      const m = /^([^:]{2,40}?)( ?:)(.*)$/.exec(i);
      return m ? `<li><strong>${esc(m[1])}${esc(m[2])}</strong>${esc(m[3])}</li>` : `<li>${esc(i)}</li>`;
    })
    .join('')}</ul>`;

function pages(t, v) {
  const out = [];
  const S = SHARED;

  // 1. Couverture : titre, positionnement, photo encadree
  out.push(`
<section class="page dark cover">
  <div class="top"><span class="lbl">${esc(t.kit)}</span>${v.banner ? `<span class="banner">${esc(v.banner)}</span>` : ''}</div>
  <h1>MAUDITE<br>MACHINE</h1>
  <div class="tag">
    <p class="genre">${esc(t.cover.genre)}</p>
    <p class="roles">${esc(t.cover.roles)}</p>
    <p class="base">${esc(t.cover.base)}</p>
  </div>
  <img class="photo cover-photo" src="img/cover-inset.jpg" alt="">
  <div class="foot">${t.cover.foot.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
</section>`);

  // 2. En bref
  const half = Math.ceil(t.glance.facts.length / 2);
  const facts = (rows) => `<dl class="facts">${rows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>`;
  out.push(`
<section class="page light glance">
  ${head(2, t.glance.title)}
  <div class="g-top">
    <p class="lead">${esc(t.glance.bio)}</p>
    <img class="photo portrait" src="img/portrait.jpg" alt="">
  </div>
  <div class="stats">${t.glance.stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
  <div class="facts-cols">${facts(t.glance.facts.slice(0, half))}${facts(t.glance.facts.slice(half))}</div>
  ${folio(t, 2)}
</section>`);

  // 3. Biographie
  out.push(`
<section class="page light bio">
  ${head(3, t.bio.title)}
  <p class="bio-lead">${esc(t.bio.lead)}</p>
  <div class="bio-text">${t.bio.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
  <div class="shared">
    <span class="lbl">${esc(t.bio.shared)}</span>
    <p>${S.shared.map(esc).join(' <i>·</i> ')}</p>
  </div>
  ${folio(t, 3)}
</section>`);

  // 4. Le set
  out.push(`
<section class="page dark set">
  ${head(4, t.set.title, t.set.kicker)}
  <img class="photo set-photo" src="img/set-inset.jpg" alt="">
  <div class="rows">
    ${t.set.blocks
      .map(([h, ps], k) => {
        const last = k === t.set.blocks.length - 1;
        const body = ps.map((p, q) => `<p>${esc(p)}${last && v.boom && q === ps.length - 1 ? ` ${esc(t.set.boom)}` : ''}</p>`).join('');
        return `<div class="row"><span class="lbl">${esc(h)}</span><div>${body}</div></div>`;
      })
      .join('')}
  </div>
  ${folio(t, 4)}
</section>`);

  // 5. Performances
  const perfList = (rows) => `<ul class="perf">${rows.map(([n, y]) => `<li><span>${esc(n)}</span><span>${esc(y)}</span></li>`).join('')}</ul>`;
  out.push(`
<section class="page light perfp">
  ${head(5, t.perf.title)}
  <img class="photo crowd-photo" src="img/crowd-inset.jpg" alt="">
  <div class="cols2">
    <div><span class="lbl">${esc(t.perf.festivalsTitle)}</span>${perfList(t.perf.festivals)}</div>
    <div><span class="lbl">${esc(t.perf.venuesTitle)}</span>${perfList(t.perf.venues)}</div>
  </div>
  <p class="rooms">${esc(t.perf.rooms)}</p>
  ${folio(t, 5)}
</section>`);

  // 6. Discographie
  const date = (y, m) => `${t.disco.months[m - 1]} ${y}`;
  out.push(`
<section class="page light disco">
  ${head(6, t.disco.title)}
  <div class="feature">
    <img class="cover-big" src="img/covers/limbos-large.jpg" alt="">
    <div>
      <span class="lbl">${esc(t.disco.latest)}</span>
      <p class="f-title">Limbos</p>
      <p class="f-meta">${esc(t.disco.limbosMeta)}</p>
      <p class="f-text">${esc(t.disco.limbosText)}</p>
      <ol class="tracklist">${S.tracklist.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    </div>
  </div>
  <span class="lbl">${esc(t.disco.catalogueTitle)}</span>
  <div class="catalogue">
    ${S.catalogue
      .map(([title, cover, type, y, m]) => `<figure><img src="img/covers/${cover}.jpg" alt=""><figcaption><b>${esc(title)}</b><span>${esc(t.disco.types[type])} · ${esc(date(y, m))}</span></figcaption></figure>`)
      .join('')}
  </div>
  <p class="also">${esc(t.disco.also)}</p>
  <div class="edits">
    <span class="lbl">${esc(t.disco.editsTitle)}</span>
    <ul>${S.edits.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    <small>${esc(t.disco.editsNote)}</small>
  </div>
  ${folio(t, 6)}
</section>`);

  // 7. Ecouter
  out.push(`
<section class="page light listen">
  ${head(7, t.listen.title)}
  <p class="intro">${esc(t.listen.intro)}</p>
  <div class="mix">
    <img class="qr" src="qr/mixtape-39.svg" alt="">
    <div>
      <span class="lbl">${esc(t.listen.mixWhat)}</span>
      <p class="m-name">${esc(t.listen.mixName)}</p>
      <p class="m-meta">${esc(t.listen.mixMeta)}</p>
      <p class="url">soundcloud.com/mauditemachine/mixtape-39-maudite-machine</p>
    </div>
  </div>
  <div class="tracks">
    ${S.tracks
      .map(
        ([name, qr, cover, url], k) => `
    <div class="track">
      ${cover ? `<img class="t-cover" src="img/covers/${cover}.jpg" alt="">` : `<div class="t-cover mono">8day</div>`}
      <div><p class="t-name">${esc(name)}</p><p class="t-meta">${esc(t.listen.trackMeta[k])}</p><p class="url">${esc(url)}</p></div>
      <img class="qr" src="qr/${qr}.svg" alt="">
    </div>`
      )
      .join('')}
  </div>
  <div class="platforms">
    <span class="lbl">${esc(t.listen.platformsTitle)}</span>
    <div class="row">${S.platforms.map(([n, qr]) => `<div class="cell"><img class="qr" src="qr/${qr}.svg" alt="">${esc(n)}</div>`).join('')}</div>
  </div>
  ${folio(t, 7)}
</section>`);

  // 8. Fiche technique
  const P = t.tech.plot;
  out.push(`
<section class="page light tech">
  ${head(8, t.tech.title)}
  <p class="intro">${esc(t.tech.intro)}</p>
  <div class="cols2 rider-cols">
    <div><span class="lbl">${esc(t.tech.blocks[0][0])}</span>${rider(t.tech.blocks[0][1])}</div>
    <div><span class="lbl">${esc(t.tech.blocks[1][0])}</span>${rider(t.tech.blocks[1][1])}</div>
  </div>
  <div class="length"><span class="lbl">${esc(t.tech.blocks[2][0])}</span>${rider(t.tech.blocks[2][1])}</div>
  <div class="plot">
    <span class="lbl">${esc(P.title)}</span>
    <div class="stage">
      <div class="mon l"><b>${esc(P.monL)}</b><span>${esc(P.mon)}</span></div>
      <div class="dj">${esc(P.dj)}</div>
      <div class="artist">${esc(P.artist)}</div>
      <div class="table">
        <div class="gear"><span>Push 3</span><span>APC40</span><span class="mac">${esc(P.mac)}</span><span>${esc(P.typhon)}</span></div>
        <div class="iface">${esc(P.iface)}</div>
        <p>${esc(P.table)}</p>
      </div>
      <div class="di">${esc(P.di)}</div>
      <div class="mon r"><b>${esc(P.monR)}</b><span>${esc(P.mon)}</span></div>
      <div class="aud">${esc(P.audience)}</div>
    </div>
    <p class="note">${esc(t.tech.plotNote)}</p>
  </div>
  ${folio(t, 8)}
</section>`);

  // 9. Accueil et voyage
  out.push(`
<section class="page light hosp">
  ${head(9, t.hosp.title)}
  <div class="grid4">
    ${t.hosp.blocks.map(([h, items]) => `<div><span class="lbl">${esc(h)}</span>${rider(items)}</div>`).join('')}
  </div>
  <img class="photo hosp-photo" src="img/hosp-band.jpg" alt="">
  ${folio(t, 9)}
</section>`);

  // 10. Contact et liens
  const C = t.contact;
  out.push(`
<section class="page dark contact">
  ${head(10, C.title)}
  <div class="who">
    <div><span class="lbl">${esc(C.intl)}</span><p class="big">Diane</p><p>vrstlrecords@gmail.com</p></div>
    <div><span class="lbl">${esc(C.na)}</span><p class="big">Mika</p><p>mauditemachine@gmail.com</p><p>+1 514 653 1423</p></div>
    <div><span class="lbl">${esc(C.label)}</span><p class="big">VRSTL Records</p><p>vrstlrecords@gmail.com</p><p>vrstlrecords.com</p></div>
  </div>
  <div class="links-wrap">
    <div>
      <span class="lbl">${esc(C.links)}</span>
      <dl class="links">${S.links.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
    </div>
    <div class="assets">
      <span class="lbl">${esc(C.assets)}</span>
      <div class="qr-card"><img class="qr" src="qr/press.svg" alt=""></div>
      <p class="a-url">mauditemachine.com/press</p>
      <p>${esc(C.assetsText)}</p>
    </div>
  </div>
  <div class="roster"><span class="lbl">${esc(C.roster)}</span><p>${S.roster.map(esc).join(' <i>·</i> ')}</p></div>
  <div class="end"><p class="name">MAUDITE MACHINE</p><p class="copy">${esc(C.copyright)}</p></div>
  ${folio(t, 10)}
</section>`);

  return out.join('\n');
}

function html(v) {
  const t = T[v.lang];
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<title>Maudite Machine, ${esc(t.kit)}</title>
<link rel="stylesheet" href="presskit.css">
</head>
<body>
${pages(t, v)}
</body>
</html>
`;
}

function render(v, pdf) {
  const tmp = join(HERE, `.render-${v.lang}${v.boom ? '-boom' : ''}.html`);
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
function images(v, pdf) {
  const dir = join(PUB, 'press', 'kit-2027', v.lang);
  mkdirSync(dir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'mm-kit-'));
  try {
    execFileSync('pdftoppm', ['-r', '150', '-png', pdf, join(work, 'p')]);
    const files = readdirSync(work).filter((f) => f.endsWith('.png')).sort();
    files.forEach((f, k) => {
      execFileSync('cwebp', ['-quiet', '-q', '80', join(work, f), '-o', join(dir, `${pad2(k + 1)}.webp`)]);
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
  let note = '';
  if (v.images) note = `, ${images(v, pdf)} pages en image`;
  console.log(`${v.out}  ${mb.toFixed(2)} Mo${note}`);
  if (mb >= 8) {
    console.error('Plus de 8 Mo : alleger les images de img/.');
    process.exitCode = 1;
  }
}
for (const c of COPIES) copyFileSync(join(PUB, 'Presskit_Maudite_Machine_2027_EN.pdf'), join(PUB, c));
console.log(`copies : ${COPIES.join(', ')}`);
