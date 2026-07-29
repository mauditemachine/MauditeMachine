/**
 * fetch-covers.mjs : recupere les pochettes manquantes des releases du Radar.
 *
 * Pour chaque entree de public/releases.json sans cover locale, le script va
 * chercher l'og:image de son champ "link" (Bandcamp, Beatport...), telecharge
 * l'image dans public/images/releases/ (max 800px, webp si ImageMagick est
 * installe, sinon resize sips dans le format d'origine) et remplit "cover".
 *
 * Usage : npm run covers
 * A relancer apres CHAQUE import de releases (les nouvelles entrees arrivent
 * avec cover vide), puis committer les images et releases.json ensemble.
 *
 * Idempotent : une release deja pourvue d'une cover locale existante est
 * ignoree, un fichier deja telecharge n'est pas re-telecharge.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES_FILE = path.join(ROOT, 'public', 'releases.json');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'releases');
const MAX_BYTES = 15 * 1024 * 1024;

// Certains sites (Beatport notamment) refusent les UA non navigateur.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const slugify = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'release';

/** ImageMagick si present ("magick" ou "convert"), sinon null. */
function magickBin() {
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  return null;
}

/** Type reel par magic bytes : refuse les pages d'erreur HTML deguisees. */
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  return null;
}

async function fetchBuffer(url, accept) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('fichier trop gros');
  return buf;
}

/** Extrait l'og:image (ou twitter:image en secours) d'une page HTML. */
function extractOgImage(html, pageUrl) {
  const metas = html.match(/<meta[^>]+>/gi) || [];
  let fallback = null;
  for (const tag of metas) {
    const isOg = /(?:property|name)=["'](?:og:image|og:image:secure_url)["']/i.test(tag);
    const isTw = /(?:property|name)=["']twitter:image(?::src)?["']/i.test(tag);
    if (!isOg && !isTw) continue;
    const m = tag.match(/content=["']([^"']+)["']/i);
    if (!m) continue;
    const abs = new URL(m[1], pageUrl).href;
    if (isOg) return abs;
    fallback = fallback || abs;
  }
  return fallback;
}

async function main() {
  const releases = JSON.parse(await fs.readFile(RELEASES_FILE, 'utf8'));
  await fs.mkdir(OUT_DIR, { recursive: true });
  const magick = magickBin();
  if (!magick) {
    console.warn('ImageMagick absent : resize via sips, format d\'origine conserve (pas de webp).');
  }

  let fetched = 0;
  let reused = 0;
  let skipped = 0;
  const failed = [];

  for (const rel of releases) {
    const tag = `${rel.artist} - ${rel.title}`.slice(0, 60);

    // Cover locale deja en place et fichier present : rien a faire.
    const cover = String(rel.cover || '').trim();
    const coverIsRemote = /^https?:\/\//i.test(cover);
    if (cover && !coverIsRemote) {
      try {
        await fs.access(path.join(ROOT, 'public', cover.replace(/^\//, '')));
        skipped++;
        continue;
      } catch {
        console.warn(`fichier manquant pour "${tag}" (${cover}), on re-telecharge`);
      }
    }

    // Nom deterministe : re-executer ne duplique rien.
    const base = `${slugify(rel.artist)}-${rel.id}`;
    const existing = (await fs.readdir(OUT_DIR)).find((f) => f.startsWith(`${base}.`));
    if (existing) {
      rel.cover = `images/releases/${existing}`;
      reused++;
      continue;
    }

    try {
      // Si la cover est deja une URL d'image, on la prend telle quelle ;
      // sinon on scrape l'og:image de la page du lien.
      let imageUrl = coverIsRemote ? cover : null;
      if (!imageUrl) {
        if (!rel.link) throw new Error('pas de lien');
        const html = (await fetchBuffer(rel.link, 'text/html,application/xhtml+xml')).toString('utf8');
        imageUrl = extractOgImage(html, rel.link);
        if (!imageUrl) throw new Error('pas d\'og:image sur la page');
      }

      const img = await fetchBuffer(imageUrl, 'image/*');
      const kind = sniffImage(img);
      if (!kind) throw new Error('la reponse n\'est pas une image');

      const tmp = path.join(OUT_DIR, `.tmp-${base}.${kind}`);
      await fs.writeFile(tmp, img);

      let outName;
      try {
        if (magick) {
          outName = `${base}.webp`;
          execFileSync(magick, [tmp, '-resize', '800x800>', '-quality', '82', path.join(OUT_DIR, outName)], { stdio: 'ignore' });
        } else {
          outName = `${base}.${kind === 'webp' ? 'webp' : kind}`;
          execFileSync('sips', ['-Z', '800', tmp, '--out', path.join(OUT_DIR, outName)], { stdio: 'ignore' });
        }
      } finally {
        await fs.rm(tmp, { force: true });
      }

      rel.cover = `images/releases/${outName}`;
      fetched++;
      console.log(`OK  ${tag}  ->  ${outName}`);
    } catch (err) {
      failed.push({ tag, raison: err.message });
      console.warn(`KO  ${tag}  (${err.message})`);
    }
  }

  await fs.writeFile(RELEASES_FILE, JSON.stringify(releases, null, 2) + '\n');

  console.log('');
  console.log(`${fetched} telechargees, ${reused} retrouvees sur disque, ${skipped} deja en place, ${failed.length} echecs.`);
  if (failed.length) {
    console.log('Echecs (cover degradee conservee, relancer npm run covers plus tard) :');
    for (const f of failed) console.log(`  - ${f.tag} : ${f.raison}`);
  }
}

main().catch((err) => {
  console.error('Erreur fatale :', err.message);
  process.exit(1);
});
