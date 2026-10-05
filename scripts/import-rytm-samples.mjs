#!/usr/bin/env node
/**
 * Les echantillons de Mika dans le choix de son du MM-RYTM (2026-10-05,
 * Mika : "mets ces samples dans le selecteur, avec les noms : Engelhardt,
 * Carassi, Stein"). Les fichiers sont sur son Mac, pas dans le depot : ce
 * script les cherche dans le dossier donne (n'importe quelle organisation :
 * a plat ou en sous-dossiers, il les retrouve par leur nom) et les copie dans
 * public/samples/rytm/<famille>/, sous un nom propre, dans l'ordre des crans
 * du potard. Le nom a la plaque est celui du fichier sans son numero
 * (03 Engelhardt.wav : ENGELHARDT).
 *
 *   npm run samples:import -- "/Users/mauditemachine/Desktop/Samples"
 *
 * Sans argument : ~/Library/Mobile Documents/com~apple~CloudDocs/User
 * Library/Samples/shots (un fichier iCloud pas encore telecharge l'est a la
 * lecture).
 */

import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SRC = path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/User Library/Samples/shots');
const SRC = process.argv[2] ? path.resolve(process.argv[2].replace(/^~(?=$|\/)/, os.homedir())) : DEFAULT_SRC;
const OUT = path.join(ROOT, 'public/samples/rytm');
const AUDIO = /\.(wav|aiff?|mp3|flac|m4a)$/i;

/**
 * [nom d'origine, nom dans le site, mot-cle] : le numero du nom dans le site
 * donne l'ordre des crans ; le mot-cle sert si le nom d'origine a change.
 */
const MAP = {
  bd: [
    ['01 AT BluePrint - Kick F.wav', '01 BluePrint.wav', /blueprint/i],
    ['01 AT VNTM - Kick G.wav', '02 VNTM.wav', /vntm/i],
    ['02 AT Tim Engelhardt - Kick G.wav', '03 Engelhardt.wav', /engelhardt/i],
    ['04 AT Sasha Carassi - Master Kick G#.wav', '04 Carassi.wav', /carassi/i],
    ['05 AT Alex Stein - Kick F#.wav', '05 Stein.wav', /\bstein\b/i],
    ['03 AT AFFKT - Kick G.wav', '06 AFFKT.wav', /affkt/i],
  ],
  sd: [
    ['Psy_Snares02.wav', '01 Psy 02.wav', /psy[ _-]*snares?[ _-]*0?2\b/i],
    ['Psy_Snares12.wav', '02 Psy 12.wav', /psy[ _-]*snares?[ _-]*12\b/i],
    ['Psy_Snares26.wav', '03 Psy 26.wav', /psy[ _-]*snares?[ _-]*26\b/i],
    ['SD A 707.wav', '04 707.wav', /707/i],
  ],
};

/** Tous les fichiers audio sous le dossier (cinq niveaux au plus), avec leur nom normalise. */
async function walk(dir, depth = 0, out = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth < 5) await walk(full, depth + 1, out);
    } else if (AUDIO.test(e.name)) {
      out.push({ full, name: e.name.normalize('NFC') });
    }
  }
  return out;
}

async function main() {
  try {
    if (!(await stat(SRC)).isDirectory()) throw new Error('pas un dossier');
  } catch {
    console.error(`Dossier introuvable : ${SRC}\nDonne le dossier des samples : npm run samples:import -- "/chemin/vers/Samples"`);
    process.exit(1);
  }
  const files = await walk(SRC);
  console.log(`${files.length} fichiers audio dans ${SRC}\n`);
  let done = 0;
  const problems = [];
  for (const [family, list] of Object.entries(MAP)) {
    await mkdir(path.join(OUT, family), { recursive: true });
    for (const [from, to, key] of list) {
      // Le nom d'origine d'abord (dans le bon sous-dossier s'il y en a un), puis le mot-cle
      const exact = files.filter((f) => f.name.toLowerCase() === from.toLowerCase());
      const pick = exact.find((f) => f.full.toLowerCase().includes(`${path.sep}${family}${path.sep}`)) ?? exact[0];
      const byKey = pick ? [] : files.filter((f) => key.test(f.name));
      const found = pick ?? (byKey.length === 1 ? byKey[0] : null);
      if (!found) {
        problems.push(byKey.length > 1 ? `${from} : plusieurs candidats (${byKey.map((f) => f.name).join(', ')})` : `${from} : introuvable`);
        continue;
      }
      await copyFile(found.full, path.join(OUT, family, to));
      console.log(`  ${family}/${to}  <-  ${found.name}`);
      done += 1;
    }
  }
  console.log(`\n${done} fichiers copies dans public/samples/rytm/`);
  if (problems.length > 0) {
    console.error(`\nA regler (${problems.length}) :\n${problems.map((m) => `  ${m}`).join('\n')}`);
    process.exit(2);
  }
  console.log('\nPour les mettre en ligne :\n  git pull && git add public/samples && git commit -m "Samples de Mika dans MM-RYTM" && git push');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
