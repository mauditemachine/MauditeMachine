/**
 * indexnow.mjs : envoie a IndexNow (Bing, Yandex, Seznam, Naver... qui se partagent les envois) les adresses du site
 * qui ont change au dernier build.
 *
 * 2026-10-21 (audit SEO F5 et IMP6, Mika : "je veux du monde dans mon site ! ... qu'on parle de ce site partout") :
 * Google lit le sitemap a son rythme ; IndexNow previent les autres moteurs en quelques minutes qu'une page a
 * change (une nouvelle date, un nouveau morceau). Lance par .github/workflows/pages.yml APRES le deploiement
 * (job indexnow), avec la liste ecrite par scripts/generate-sitemap.mjs (indexnow-urls.txt : seulement les
 * adresses dont le contenu a change depuis le build en ligne). Jamais bloquant : une erreur est ecrite dans le
 * journal et le script rend 0 (le site est deja en ligne).
 *
 * La cle : le fichier public/<32 caracteres hexadecimaux>.txt (servi a la racine du site, il prouve que le domaine
 * est a nous) ; la meme valeur dans le fichier. Sans cle ni adresse : rien n'est envoye.
 *
 *   node scripts/indexnow.mjs                 les adresses de indexnow-urls.txt
 *   node scripts/indexnow.mjs URL1 URL2       ces adresses
 *   DRY_RUN=1 node scripts/indexnow.mjs       montre l'envoi sans rien envoyer
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE } from './seo-shared.mjs';

const HOST = new URL(SITE).host;
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const MAX = 10000;

function keyOf() {
  try {
    const f = readdirSync(join(ROOT, 'public')).find((x) => /^[0-9a-f]{32}\.txt$/.test(x));
    if (!f) return null;
    const key = readFileSync(join(ROOT, 'public', f), 'utf8').trim();
    return key === f.replace(/\.txt$/, '') ? key : null;
  } catch {
    return null;
  }
}

function urlsOf() {
  const given = process.argv.slice(2);
  const list = given.length ? given : existsSync(join(ROOT, 'indexnow-urls.txt')) ? readFileSync(join(ROOT, 'indexnow-urls.txt'), 'utf8').split('\n') : [];
  // Seulement les adresses du site, une fois chacune
  return [...new Set(list.map((u) => u.trim()).filter((u) => u.startsWith(`${SITE}/`)))].slice(0, MAX);
}

async function main() {
  const key = keyOf();
  const urlList = urlsOf();
  if (!key) return console.log('IndexNow : pas de cle dans public/, rien envoye');
  if (!urlList.length) return console.log('IndexNow : aucune adresse changee, rien envoye');
  const body = { host: HOST, key, keyLocation: `${SITE}/${key}.txt`, urlList };
  if (process.env.DRY_RUN === '1') return console.log(`IndexNow (essai) : ${JSON.stringify(body)}`);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(t);
    // 200 : recu ; 202 : recu, cle en cours de verification ; 4xx : cle, adresse ou quota a revoir (le journal le dit)
    console.log(`IndexNow : ${urlList.length} adresse(s) envoyee(s), reponse ${res.status}`);
  } catch (e) {
    console.log(`IndexNow : envoi impossible (${e instanceof Error ? e.message : e}), le site est deja en ligne`);
  }
}

await main();
