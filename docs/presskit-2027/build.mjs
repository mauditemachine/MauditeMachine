#!/usr/bin/env node
/**
 * Fabrique les deux PDF du press kit 2027 a partir de presskit.html :
 *   public/Presskit_Maudite_Machine_2027.pdf          (bandeau Boom Festival)
 *   public/Presskit_Maudite_Machine_2027_generic.pdf  (sans bandeau ni Alchemy Circle)
 *
 * Rendu par Google Chrome sans tete (--print-to-pdf), aucune dependance npm.
 * Usage : node docs/presskit-2027/build.mjs
 * Chrome ailleurs : CHROME=/chemin/vers/chrome node docs/presskit-2027/build.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Bandeau de couverture, une variable par candidature. */
const VARIANTS = [
  { out: 'Presskit_Maudite_Machine_2027.pdf', banner: 'Boom Festival 2027 · Alchemy Circle', boom: true },
  { out: 'Presskit_Maudite_Machine_2027_generic.pdf', banner: '', boom: false },
];

const template = readFileSync(join(HERE, 'presskit.html'), 'utf8');

for (const v of VARIANTS) {
  let html = template.replace('{{BANNER}}', v.banner);
  // Les blocs <!--BOOM-->...<!--/BOOM--> ne parlent qu'au Boom Festival
  html = v.boom ? html.replace(/<!--\/?BOOM-->/g, '') : html.replace(/<!--BOOM-->[\s\S]*?<!--\/BOOM-->/g, '');
  // Le fichier temporaire reste a cote du gabarit : les chemins relatifs (css, img, qr, polices) tiennent
  const tmp = join(HERE, `.render-${v.boom ? 'boom' : 'generic'}.html`);
  writeFileSync(tmp, html);
  const pdf = join(ROOT, 'public', v.out);
  try {
    execFileSync(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--allow-file-access-from-files',
        '--no-pdf-header-footer',
        '--virtual-time-budget=15000',
        `--print-to-pdf=${pdf}`,
        pathToFileURL(tmp).href,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
  } finally {
    rmSync(tmp, { force: true });
  }
  const mb = statSync(pdf).size / 1024 / 1024;
  console.log(`${v.out}  ${mb.toFixed(2)} Mo`);
  if (mb >= 8) {
    console.error('Plus de 8 Mo : alleger les images de img/.');
    process.exitCode = 1;
  }
}
