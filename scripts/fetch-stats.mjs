/**
 * fetch-stats.mjs : collecteur des stats de diffusion multi-plateformes.
 *
 * Remplace la "route API /api/admin/stats" du brief : ce site est statique
 * (GitHub Pages), les secrets vivent donc ici, cote machine :
 * - en local : .env a la racine (charge via process.loadEnvFile, Node 20+)
 * - dans le cron : GitHub Secrets (.github/workflows/stats.yml)
 *
 * Chaque source echoue INDEPENDAMMENT : cle absente ou API en panne ->
 * {status:"unavailable", error}, les autres continuent, exit 0 quand meme
 * (le cron ne doit jamais casser le deploiement). SoundCloud sans cle ->
 * {status:"disabled"} (module optionnel, voulu ainsi).
 *
 * Ecrit un snapshot date en fin de public/data/stats-public.json (cap 400),
 * en preservant le bloc "manual" (imports CSV). Les revenus Ditto ne passent
 * JAMAIS ici : data/stats-private.json, local uniquement.
 *
 * Usage : npm run stats            (ou node scripts/fetch-stats.mjs)
 *         ORIGIN=cron npm run stats  (marquage du snapshot)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_FILE = path.join(ROOT, 'public', 'data', 'stats-public.json');
const MAX_SNAPSHOTS = 400;

// .env local optionnel (le cron passe par les GitHub Secrets)
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {}

const env = (k) => (process.env[k] || '').trim();

const SPOTIFY_ARTIST_ID = '2FHPGWPEBQbCsgkLP9uuI4';

async function getJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body.slice(0, 140)}`);
  }
  return res.json();
}

const unavailable = (error) => ({ status: 'unavailable', error: String(error).slice(0, 200) });

/* ---------------- YouTube Data API v3 ---------------- */
async function fetchYouTube() {
  const key = env('YOUTUBE_API_KEY');
  const channelId = env('YOUTUBE_CHANNEL_ID');
  if (!key || !channelId) return unavailable('YOUTUBE_API_KEY / YOUTUBE_CHANNEL_ID manquants');

  const chan = await getJson(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}&key=${key}`,
  );
  const item = chan.items?.[0];
  if (!item) throw new Error('chaine introuvable');
  const stats = item.statistics || {};
  const uploads = item.contentDetails?.relatedPlaylists?.uploads;

  let videos = [];
  if (uploads) {
    const list = await getJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=10&key=${key}`,
    );
    const ids = (list.items || []).map((v) => v.contentDetails?.videoId).filter(Boolean);
    if (ids.length) {
      const details = await getJson(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(',')}&key=${key}`,
      );
      videos = (details.items || []).map((v) => ({
        id: v.id,
        title: v.snippet?.title || '',
        publishedAt: v.snippet?.publishedAt || '',
        thumbnail: v.snippet?.thumbnails?.medium?.url || '',
        views: Number(v.statistics?.viewCount || 0),
        likes: Number(v.statistics?.likeCount || 0),
        comments: Number(v.statistics?.commentCount || 0),
      }));
    }
  }

  return {
    status: 'ok',
    subscribers: Number(stats.subscriberCount || 0),
    totalViews: Number(stats.viewCount || 0),
    videoCount: Number(stats.videoCount || 0),
    videos,
  };
}

/* ------------- YouTube Analytics (geo, OAuth) ------------- */
async function fetchYouTubeGeo() {
  const clientId = env('YT_OAUTH_CLIENT_ID');
  const clientSecret = env('YT_OAUTH_CLIENT_SECRET');
  const refreshToken = env('YT_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    return unavailable('OAuth non configure (voir scripts/youtube-oauth.mjs)');
  }

  const tok = await getJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const data = await getJson(
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${start}&endDate=${end}&metrics=views&dimensions=country&sort=-views&maxResults=25`,
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  );
  const countries = {};
  for (const row of data.rows || []) countries[row[0]] = row[1];
  return { status: 'ok', countries };
}

/* ---------------- Spotify (client credentials) ---------------- */
async function fetchSpotify() {
  const id = env('SPOTIFY_CLIENT_ID');
  const secret = env('SPOTIFY_CLIENT_SECRET');
  if (!id || !secret) return unavailable('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET manquants');

  const tok = await getJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  const auth = { headers: { Authorization: `Bearer ${tok.access_token}` } };

  const artist = await getJson(`https://api.spotify.com/v1/artists/${SPOTIFY_ARTIST_ID}`, auth);
  const top = await getJson(
    `https://api.spotify.com/v1/artists/${SPOTIFY_ARTIST_ID}/top-tracks?market=FR`,
    auth,
  );

  return {
    status: 'ok',
    followers: Number(artist.followers?.total || 0),
    popularity: Number(artist.popularity || 0),
    topTracks: (top.tracks || []).slice(0, 10).map((t) => ({
      id: t.id,
      title: t.name,
      album: t.album?.name || '',
      cover: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
      popularity: Number(t.popularity || 0),
    })),
  };
}

/* ---------------- Instagram (Meta Graph v21) ---------------- */
const META_V = 'v21.0';

async function fetchInstagram() {
  const token = env('META_ACCESS_TOKEN');
  const igId = env('IG_BUSINESS_ACCOUNT_ID');
  if (!token || !igId) return unavailable('META_ACCESS_TOKEN / IG_BUSINESS_ACCOUNT_ID manquants');
  const base = `https://graph.facebook.com/${META_V}`;

  const account = await getJson(`${base}/${igId}?fields=followers_count&access_token=${token}`);

  // Reach / impressions du compte (28 derniers jours)
  let reach, impressions;
  try {
    const ins = await getJson(
      `${base}/${igId}/insights?metric=reach,impressions&period=days_28&access_token=${token}`,
    );
    for (const m of ins.data || []) {
      const v = m.values?.[m.values.length - 1]?.value;
      if (m.name === 'reach') reach = Number(v || 0);
      if (m.name === 'impressions') impressions = Number(v || 0);
    }
  } catch {}

  // Derniers posts / reels avec leurs metriques
  let posts = [];
  try {
    const media = await getJson(
      `${base}/${igId}/media?fields=id,media_type,media_product_type,caption,timestamp,thumbnail_url,media_url,permalink,like_count,comments_count&limit=12&access_token=${token}`,
    );
    posts = await Promise.all(
      (media.data || []).map(async (m) => {
        const post = {
          id: m.id,
          type: m.media_product_type || m.media_type || '',
          caption: String(m.caption || '').slice(0, 120),
          timestamp: m.timestamp || '',
          thumbnail: m.thumbnail_url || m.media_url || '',
          permalink: m.permalink || '',
          likes: Number(m.like_count || 0),
          comments: Number(m.comments_count || 0),
        };
        try {
          const isReel = post.type === 'REELS';
          const metrics = isReel ? 'plays,shares,saved' : 'shares,saved';
          const mi = await getJson(`${base}/${m.id}/insights?metric=${metrics}&access_token=${token}`);
          for (const it of mi.data || []) {
            const v = Number(it.values?.[0]?.value || 0);
            if (it.name === 'plays') post.plays = v;
            if (it.name === 'shares') post.shares = v;
            if (it.name === 'saved') post.saves = v;
          }
        } catch {}
        return post;
      }),
    );
  } catch {}

  // Demographie audience (necessite assez d'abonnes, sinon l'API refuse)
  const audience = {};
  for (const [key, metric] of [
    ['cities', 'audience_city'],
    ['countries', 'audience_country'],
    ['ages', 'audience_gender_age'],
  ]) {
    try {
      const a = await getJson(
        `${base}/${igId}/insights?metric=${metric}&period=lifetime&access_token=${token}`,
      );
      audience[key] = a.data?.[0]?.values?.[0]?.value || {};
    } catch {}
  }

  return {
    status: 'ok',
    followers: Number(account.followers_count || 0),
    reach,
    impressions,
    posts,
    audience,
  };
}

/* ---------------- Facebook Page (meme token Meta) ---------------- */
async function fetchFacebook() {
  const token = env('META_ACCESS_TOKEN');
  const pageId = env('FB_PAGE_ID');
  if (!token || !pageId) return unavailable('META_ACCESS_TOKEN / FB_PAGE_ID manquants');
  const base = `https://graph.facebook.com/${META_V}`;

  const page = await getJson(`${base}/${pageId}?fields=followers_count&access_token=${token}`);
  let reach;
  try {
    const ins = await getJson(
      `${base}/${pageId}/insights?metric=page_impressions_unique&period=days_28&access_token=${token}`,
    );
    reach = Number(ins.data?.[0]?.values?.slice(-1)[0]?.value || 0);
  } catch {}

  return { status: 'ok', followers: Number(page.followers_count || 0), reach };
}

/* ---------------- SoundCloud (optionnel) ---------------- */
async function fetchSoundCloud() {
  const clientId = env('SOUNDCLOUD_CLIENT_ID');
  if (!clientId) return { status: 'disabled', error: 'SOUNDCLOUD_CLIENT_ID absent (module optionnel)' };

  const user = await getJson(
    `https://api-v2.soundcloud.com/resolve?url=https://soundcloud.com/mauditemachine&client_id=${clientId}`,
  );
  const tracks = await getJson(
    `https://api-v2.soundcloud.com/users/${user.id}/tracks?limit=20&client_id=${clientId}`,
  );
  return {
    status: 'ok',
    followers: Number(user.followers_count || 0),
    tracks: (tracks.collection || []).map((t) => ({
      id: t.id,
      title: t.title,
      plays: Number(t.playback_count || 0),
      likes: Number(t.likes_count || 0),
      reposts: Number(t.reposts_count || 0),
    })),
  };
}

/* ---------------- Assemblage ---------------- */
async function main() {
  const run = async (name, fn) => {
    try {
      const out = await fn();
      console.log(`${out.status === 'ok' ? 'OK ' : out.status === 'disabled' ? '-- ' : 'KO '} ${name}${out.error ? ` (${out.error})` : ''}`);
      return out;
    } catch (err) {
      console.warn(`KO  ${name} (${err.message})`);
      return unavailable(err.message);
    }
  };

  const [youtube, youtubeGeo, spotify, instagram, facebook, soundcloud] = await Promise.all([
    run('youtube', fetchYouTube),
    run('youtube-geo', fetchYouTubeGeo),
    run('spotify', fetchSpotify),
    run('instagram', fetchInstagram),
    run('facebook', fetchFacebook),
    run('soundcloud', fetchSoundCloud),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    origin: env('ORIGIN') || 'manual',
    youtube,
    youtubeGeo,
    spotify,
    instagram,
    facebook,
    soundcloud,
  };

  let current = { snapshots: [], manual: {} };
  try {
    current = JSON.parse(await fs.readFile(PUBLIC_FILE, 'utf8'));
  } catch {}
  current.snapshots = [...(current.snapshots || []), snapshot].slice(-MAX_SNAPSHOTS);
  current.manual = current.manual || {};

  await fs.mkdir(path.dirname(PUBLIC_FILE), { recursive: true });
  await fs.writeFile(PUBLIC_FILE, JSON.stringify(current, null, 2) + '\n');

  const okCount = [youtube, youtubeGeo, spotify, instagram, facebook, soundcloud].filter(
    (s) => s.status === 'ok',
  ).length;
  console.log(`\nSnapshot ajoute (${okCount}/6 sources ok) -> public/data/stats-public.json (${current.snapshots.length} snapshots)`);
}

main().catch((err) => {
  // Meme une erreur d'ecriture ne doit pas peter le cron en boucle : log et exit 1
  console.error('Erreur fatale :', err.message);
  process.exit(1);
});
