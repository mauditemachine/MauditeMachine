/**
 * youtube-oauth.mjs : flow OAuth ONE-SHOT pour YouTube Analytics (geo).
 *
 * L'API Analytics exige un OAuth utilisateur (pas de cle simple). Ce script
 * se lance UNE fois, en local, pour obtenir le refresh_token permanent que
 * le collecteur utilisera ensuite (cron et refresh manuel).
 *
 * Prerequis (console.cloud.google.com, une fois) :
 *   1. Creer un projet, activer "YouTube Analytics API"
 *   2. Ecran de consentement OAuth (type externe, ton compte en testeur)
 *   3. Identifiants -> ID client OAuth -> type "Application de bureau"
 *   4. Mettre client id/secret dans .env :
 *        YT_OAUTH_CLIENT_ID=...
 *        YT_OAUTH_CLIENT_SECRET=...
 *
 * Usage :
 *   node scripts/youtube-oauth.mjs
 *   -> ouvre l'URL affichee, autorise avec le compte YouTube de la chaine,
 *      le script recupere le code sur http://localhost:8123 et affiche le
 *      YT_REFRESH_TOKEN a coller dans .env (local) et GitHub Secrets (cron).
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {}

const CLIENT_ID = (process.env.YT_OAUTH_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.YT_OAUTH_CLIENT_SECRET || '').trim();
const REDIRECT = 'http://localhost:8123/callback';
const SCOPE = 'https://www.googleapis.com/auth/yt-analytics.readonly';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('YT_OAUTH_CLIENT_ID et YT_OAUTH_CLIENT_SECRET requis dans .env (voir en-tete du script).');
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // force la delivrance d'un refresh_token
  });

console.log('\n1. Ouvre cette URL dans ton navigateur et autorise l\'acces :\n');
console.log(authUrl + '\n');
console.log('2. J\'attends le retour sur ' + REDIRECT + ' ...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8123');
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Pas de code dans la reponse Google.');
    return;
  }

  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    }).then((r) => r.json());

    if (!tok.refresh_token) throw new Error(JSON.stringify(tok).slice(0, 300));

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<body style="background:#0a0a0a;color:#eee;font-family:sans-serif;padding:40px">Refresh token obtenu. Retourne dans le terminal, tu peux fermer cet onglet.</body>');

    console.log('3. SUCCES. Ajoute cette ligne dans .env ET dans les GitHub Secrets :\n');
    console.log(`YT_REFRESH_TOKEN=${tok.refresh_token}\n`);
  } catch (err) {
    res.writeHead(500).end('Echec echange du code, regarde le terminal.');
    console.error('Echec :', err.message);
  } finally {
    server.close();
  }
});

server.listen(8123);
