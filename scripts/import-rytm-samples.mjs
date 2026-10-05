#!/usr/bin/env node
/**
 * Les echantillons de Mika dans le choix de son du MM-RYTM (2026-10-05,
 * Mika : "mets ces samples dans le selecteur, avec les noms : Engelhardt,
 * Carassi, Stein"). Les fichiers sont sur son Mac (iCloud Drive), pas dans le
 * depot : ce script les copie dans public/samples/rytm/<famille>/, sous un
 * nom propre, dans l'ordre des crans du potard. Le nom a la plaque est celui
 * du fichier sans son numero (03 Engelhardt.wav : ENGELHARDT).
 *
 *   npm run samples:import
 *   npm run samples:import -- "/autre/dossier/shots"
 *
 * Le dossier source contient bd/ et sd/ ; par defaut celui de Mika :
 * ~/Library/Mobile Documents/com~apple~CloudDocs/User Library/Samples/shots
 * (un fichier iCloud pas encore telecharge l'est a la lecture).
 */

import { copyFile, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SRC = path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/User Library/Samples/shots');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SRC;
const OUT = path.join(ROOT, 'public/samples/rytm');

/** [fichier d'origine, nom dans le site] ; le numero donne l'ordre des crans */
const MAP = {
  bd: [
    ['01 AT BluePrint - Kick F.wav', '01 BluePrint.wav'],
    ['01 AT VNTM - Kick G.wav', '02 VNTM.wav'],
    ['02 AT Tim Engelhardt - Kick G.wav', '03 Engelhardt.wav'],
    ['04 AT Sasha Carassi - Master Kick G#.wav', '04 Carassi.wav'],
    ['05 AT Alex Stein - Kick F#.wav', '05 Stein.wav'],
    ['03 AT AFFKT - Kick G.wav', '06 AFFKT.wav'],
  ],
  sd: [
    ['Psy_Snares02.wav', '01 Psy 02.wav'],
    ['Psy_Snares12.wav', '02 Psy 12.wav'],
    ['Psy_Snares26.wav', '03 Psy 26.wav'],
    ['SD A 707.wav', '04 707.wav'],
  ],
};

async function main() {
  try {
    await stat(SRC);
  } catch {
    console.error(`Dossier introuvable : ${SRC}\nDonne le dossier "shots" : npm run samples:import -- "/chemin/vers/shots"`);
    process.exit(1);
  }
  let done = 0;
  const missing = [];
  for (const [family, files] of Object.entries(MAP)) {
    await mkdir(path.join(OUT, family), { recursive: true });
    for (const [from, to] of files) {
      const src = path.join(SRC, family, from);
      try {
        await copyFile(src, path.join(OUT, family, to));
        console.log(`  ${family}/${to}`);
        done += 1;
      } catch {
        missing.push(src);
      }
    }
  }
  console.log(`\n${done} fichiers copies dans public/samples/rytm/`);
  if (missing.length > 0) {
    console.error(`\nIntrouvables (${missing.length}) :\n${missing.map((m) => `  ${m}`).join('\n')}`);
    process.exit(2);
  }
  console.log('\nPour les mettre en ligne :\n  git pull && git add public/samples && git commit -m "Samples de Mika dans MM-RYTM" && git push');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
