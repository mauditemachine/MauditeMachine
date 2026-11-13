/**
 * fetch-track-covers.mjs : les pochettes des morceaux de Maudite Machine (2026-11-13, le lecteur TRACKS du
 * telephone, Mika : "un lecteur simple pour ecouter les tracks de maudite machine et met les covers").
 *
 * Pour chaque morceau de src/v2/data/discography.json, l'og:image de sa page Bandcamp (champ "link") : la pochette
 * officielle de la sortie (un album donne la meme a tous ses morceaux, telechargee une fois). Ecrit
 * public/images/covers/<sortie>.webp (480 px, carre) et src/v4/data/covers.json (id du morceau -> chemin).
 *
 * Usage : npm run covers:tracks
 * A relancer apres l'ajout d'un morceau a la discographie, puis committer les images et covers.json ensemble.
 * Idempotent : une image deja la n'est pas retelechargee (--force : tout refaire).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DISCO = path.join(ROOT, 'src', 'v2', 'data', 'discography.json');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'covers');
const MAP_FILE = path.join(ROOT, 'src', 'v4', 'data', 'covers.json');
const SIZE = 480;
const FORCE = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** La sortie d'une page Bandcamp : /album/limbos -> limbos, /track/kouklikou -> kouklikou. */
const releaseSlug = (link) => {
  const m = /bandcamp\.com\/(?:album|track)\/([a-z0-9-]+)/i.exec(link);
  return m ? m[1].toLowerCase() : null;
};

async function get(url, accept) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** L'og:image de la page, en grand (Bandcamp : _10, 1200 px ; la page donne _5). */
function ogImage(html) {
  for (const tag of html.match(/<meta[^>]+>/gi) || []) {
    if (!/property=["']og:image["']/i.test(tag)) continue;
    const m = tag.match(/content=["']([^"']+)["']/i);
    if (m) return m[1].replace(/_\d+\.(jpg|png)$/i, '_10.$1');
  }
  return null;
}

/** Carre de SIZE px en WebP : sharp s'il est la, sinon ImageMagick. */
async function toWebp(buf, out) {
  try {
    const { default: sharp } = await import('sharp');
    await sharp(buf).resize(SIZE, SIZE, { fit: 'cover' }).webp({ quality: 80 }).toFile(out);
    return;
  } catch (e) {
    if (e && e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  }
  const tmp = `${out}.src`;
  await fs.writeFile(tmp, buf);
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, [tmp, '-resize', `${SIZE}x${SIZE}^`, '-gravity', 'center', '-extent', `${SIZE}x${SIZE}`, '-quality', '80', out]);
      await fs.rm(tmp, { force: true });
      return;
    } catch {
      /* le suivant */
    }
  }
  await fs.rm(tmp, { force: true });
  throw new Error('ni sharp ni ImageMagick');
}

const exists = (p) =>
  fs.access(p).then(
    () => true,
    () => false
  );

const tracks = JSON.parse(await fs.readFile(DISCO, 'utf8')).tracks;
await fs.mkdir(OUT_DIR, { recursive: true });
const map = {};
const done = new Map();
let fetched = 0;
let failed = 0;
for (const t of tracks) {
  const slug = releaseSlug(t.link || '');
  if (!slug) {
    console.log(`-  ${t.id} : pas de page Bandcamp (${t.link})`);
    failed++;
    continue;
  }
  const file = `${slug}.webp`;
  const out = path.join(OUT_DIR, file);
  if (!done.has(slug)) {
    let ok = !FORCE && (await exists(out));
    if (!ok) {
      try {
        const html = (await get(t.link, 'text/html')).toString('utf8');
        const img = ogImage(html);
        if (!img) throw new Error('pas d og:image');
        await toWebp(await get(img, 'image/*'), out);
        fetched++;
        ok = true;
        console.log(`ok ${slug} <- ${img}`);
      } catch (e) {
        console.log(`-  ${slug} : ${e.message}`);
        failed++;
      }
    }
    done.set(slug, ok);
  }
  if (done.get(slug)) map[t.id] = `/images/covers/${file}`;
}
await fs.writeFile(MAP_FILE, `${JSON.stringify(map, null, 2)}\n`);
console.log(`${Object.keys(map).length}/${tracks.length} morceaux avec pochette, ${fetched} telechargee(s), ${failed} echec(s) -> ${path.relative(ROOT, MAP_FILE)}`);
