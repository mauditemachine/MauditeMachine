import express from 'express';
import { promises as fs } from 'fs';
import { existsSync, statSync, readdirSync } from 'node:fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Secret optionnel en local (ADMIN_PASSWORD ou ADMIN_API_KEY, jamais VITE_*).
// S'il est defini, il est exige comme en production.
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY || '';

// Mode reseau local (iPad) : OPT-IN EXPLICITE uniquement (--lan ou ADMIN_LAN=1).
// Par defaut le serveur n'ecoute que 127.0.0.1. En mode LAN, ADMIN_PASSWORD
// devient OBLIGATOIRE : refus de demarrer sans mot de passe.
const LAN_MODE = process.argv.includes('--lan') || process.env.ADMIN_LAN === '1';
if (LAN_MODE && !ADMIN_SECRET) {
  console.error('❌ Mode LAN demande (--lan) sans ADMIN_PASSWORD defini : refus de demarrer.');
  console.error('   export ADMIN_PASSWORD=... puis relance.');
  process.exit(1);
}

// CORS restreint aux origines de dev.
// Avant : app.use(cors()) acceptait TOUTES les origines, donc n'importe quel
// site ouvert dans le navigateur pouvait ecrire dans les JSON locaux pendant
// que ce serveur tournait.
// En mode LAN : les origines http://<ip-privee>:5173 sont aussi admises
// (l'auth par mot de passe reste exigee sur chaque requete).
const isPrivateLanOrigin = (origin) =>
  /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|\[?fd[0-9a-f:]+\]?|[a-z0-9-]+\.local)(:\d+)?$/i.test(
    origin || ''
  );
app.use(
  cors({
    origin: (origin, cb) => {
      // localhost sur N'IMPORTE quel port : vite choisit un port libre
      // (autoPort) et une whitelist de ports figes casserait l'admin.
      // Une page web externe ne peut pas avoir une origin localhost.
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
      if (!origin || isLocalhost || (LAN_MODE && isPrivateLanOrigin(origin))) {
        return cb(null, true);
      }
      cb(null, false);
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '50mb' })); // Augmenter la limite à 50MB

/** Comparaison a temps constant (hash prealable pour egaliser les longueurs). */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function extractSecret(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const legacy = req.headers['x-api-key'];
  return typeof legacy === 'string' ? legacy : '';
}

/**
 * Auth locale. Si ADMIN_SECRET est defini on l'exige ; sinon on laisse passer
 * (confort de dev) mais l'acces reste limite a localhost par le CORS ci-dessus.
 */
function authMiddleware(req, res, next) {
  if (!ADMIN_SECRET) return next();
  if (!safeEqual(extractSecret(req), ADMIN_SECRET)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

if (!ADMIN_SECRET) {
  console.warn('[dev] ADMIN_PASSWORD non defini : ecriture locale ouverte (CORS limite a localhost).');
}

// Verification du secret pour l'ecran de login admin
app.post('/api/auth', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Authenticated' });
});

// Chemin vers les fichiers JSON
const PUBLIC_DIR = path.join(__dirname, 'public');

// ============================================================
// UPLOAD : validation stricte
// Avant, `req.query.folder` partait brut dans path.join(PUBLIC_DIR, folder) :
// ?folder=../../.github/workflows permettait d'ecrire hors de public/.
// Et le fileFilter ne regardait que file.mimetype, fourni par le client.
// ============================================================

const ALLOWED_UPLOAD_FOLDERS = new Set([
  'images',
  'events',
  'images/goodies',
  'images/releases',
]);

const ALLOWED_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/** Renvoie le dossier s'il est explicitement autorise, sinon null. */
function sanitizeFolder(folder) {
  const f = String(folder ?? 'images').trim().replace(/^\/+|\/+$/g, '');
  return ALLOWED_UPLOAD_FOLDERS.has(f) ? f : null;
}

/** Extension image sure, deduite du nom d'origine (jamais utilisee telle quelle). */
function safeExtension(originalname) {
  const base = String(originalname ?? '').split(/[/\\]/).pop() || '';
  const ext = (base.match(/\.([a-zA-Z0-9]+)$/) || [])[1];
  if (!ext) return null;
  const low = ext.toLowerCase();
  return ALLOWED_IMAGE_EXT.has(low) ? low : null;
}

/** Detection du type reel par magic bytes (le mimetype client ne prouve rien). */
function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// Stockage en memoire : on ecrit sur disque seulement apres validation des
// magic bytes. diskStorage aurait pose le fichier avant toute verification.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: function (req, file, cb) {
    // Pre-filtre bon marche ; la vraie validation est faite par magic bytes.
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seulement les fichiers images sont acceptés'));
    }
  }
});

// ============================================================
// IMAGES DES EVENTS : le depot fait autorite, jamais le CDN Sanity
//
// Sanity fournit le texte des events, mais le site doit servir ses visuels
// depuis public/. Sans ce filet, sauvegarder un seul event reecrivait tous
// les chemins de events.json en URL cdn.sanity.io et les fichiers de
// public/events/ ne servaient plus a rien.
//
// Cote client, loadEvents() rapproche deja chaque event de son entree locale.
// Ici c'est la ceinture de securite : un backup localStorage d'une ancienne
// session peut encore contenir des URL distantes, et elles ne doivent pas
// atterrir dans le JSON.
// ============================================================

const SANITY_CDN_HOST = 'cdn.sanity.io';
const EVENTS_DIR = path.join(PUBLIC_DIR, 'events');
const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;

const isRemoteImage = (src) => typeof src === 'string' && /^https?:\/\//i.test(src);

// Insensible a la casse, aux espaces ET a la ponctuation : sans ca, renommer
// "GROOVE & BASS" en "GROOVE&BASS" d'un seul cote cassait le rapprochement.
const eventKey = (date, title) =>
  `${String(date ?? '').slice(0, 10)}|${String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`;

const eventDay = (date) => String(date ?? '').slice(0, 10);

/** Slug de nom de fichier, deduit du titre de l'event. */
function slugify(text) {
  const s = String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'event';
}

/**
 * Rapatrie une image Sanity dans public/events/ et renvoie son chemin relatif.
 * Renvoie null au moindre doute : mieux vaut garder l'URL distante que
 * d'ecrire un fichier douteux ou de faire echouer la sauvegarde.
 */
async function downloadSanityImage(rawUrl, title) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  // Garde SSRF : uniquement le CDN Sanity en https, aucune autre destination.
  if (url.protocol !== 'https:' || url.hostname !== SANITY_CDN_HOST) return null;

  const assetName = url.pathname.split('/').pop() || '';
  const ext = safeExtension(assetName);
  if (!ext) return null;

  // Le hash de l'asset rend le nom deterministe : re-sauvegarder ne
  // retelecharge pas et ne cree pas de doublon.
  const hash = (assetName.match(/^([a-f0-9]{8})/i) || [])[1] || 'asset';
  const filename = `${slugify(title)}-${hash}.${ext}`;
  const target = path.join(EVENTS_DIR, filename);

  // Meme garde que l'upload : le fichier doit rester dans public/events/.
  if (path.dirname(path.resolve(target)) !== path.resolve(EVENTS_DIR)) return null;

  try {
    await fs.access(target);
    return `events/${filename}`; // deja rapatrie
  } catch {}

  try {
    const res = await fetch(url.href);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_REMOTE_IMAGE_BYTES) return null;
    if (!detectImageType(buf)) return null; // magic bytes, comme a l'upload
    await fs.mkdir(EVENTS_DIR, { recursive: true });
    await fs.writeFile(target, buf);
    console.log(`⬇️  Image rapatriée depuis Sanity : public/events/${filename}`);
    return `events/${filename}`;
  } catch (err) {
    console.warn(`⚠️  Rapatriement impossible (${rawUrl}) :`, err.message);
    return null;
  }
}

/** Remplace toute URL distante par un chemin local, en rapatriant si besoin. */
async function localizeEventImages(events, previous) {
  const parCle = new Map();
  // Repli par date, neutralise si deux events partagent la meme date.
  const parDate = new Map();
  for (const ev of previous) {
    if (!ev?.image || isRemoteImage(ev.image)) continue;
    parCle.set(eventKey(ev.date, ev.title), ev.image);
    const jour = eventDay(ev.date);
    parDate.set(jour, parDate.has(jour) ? null : ev.image);
  }

  const out = [];
  for (const ev of events) {
    if (!ev || !isRemoteImage(ev.image)) {
      out.push(ev);
      continue;
    }
    const local =
      parCle.get(eventKey(ev.date, ev.title)) ||
      parDate.get(eventDay(ev.date)) ||
      (await downloadSanityImage(ev.image, ev.title));
    out.push(local ? { ...ev, image: local } : ev);
  }
  return out;
}

// Route pour sauvegarder les messages
app.post('/api/save-messages', authMiddleware, async (req, res) => {
  try {
    const messages = req.body;
    const filePath = path.join(PUBLIC_DIR, 'messages.json');
    
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2));
    
    console.log('✅ Messages sauvegardés dans messages.json');
    res.json({ success: true, message: 'Messages sauvegardés avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde messages:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour sauvegarder les événements
app.post('/api/save-events', authMiddleware, async (req, res) => {
  try {
    const filePath = path.join(PUBLIC_DIR, 'events.json');

    // Etat actuel : sert a retrouver le chemin local deja connu d'un event
    // dont l'admin renverrait une URL distante.
    let previous = [];
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (Array.isArray(parsed)) previous = parsed;
    } catch {}

    const incoming = Array.isArray(req.body) ? req.body : [];
    const events = await localizeEventImages(incoming, previous);

    const remoteLeft = events.filter((ev) => isRemoteImage(ev?.image)).length;
    if (remoteLeft > 0) {
      console.warn(`⚠️  ${remoteLeft} event(s) gardent une image distante : rapatriement impossible.`);
    }

    await fs.writeFile(filePath, JSON.stringify(events, null, 2));

    console.log('✅ Événements sauvegardés dans events.json');
    res.json({ success: true, message: 'Événements sauvegardés avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde événements:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour sauvegarder les releases (onglet releases -> page /radar).
// Longtemps absente d'ICI alors qu'elle existait dans api/server.js, le
// serveur jamais deploye : l'admin local repondait "Saved!" mais le POST
// partait en 404 et public/releases.json ne changeait jamais.
app.post('/api/save-releases', authMiddleware, async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: 'Body must be an array' });
    }
    const filePath = path.join(PUBLIC_DIR, 'releases.json');
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2));
    console.log('✅ Releases sauvegardées dans releases.json');
    res.json({ success: true, message: 'Releases sauvegardées avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde releases:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour sauvegarder le merchandising
app.post('/api/save-merch', authMiddleware, async (req, res) => {
  try {
    const merchItems = req.body;
    const filePath = path.join(PUBLIC_DIR, 'store.json');
    
    await fs.writeFile(filePath, JSON.stringify(merchItems, null, 2));
    
    console.log('✅ Merchandising sauvegardé dans store.json');
    res.json({ success: true, message: 'Merchandising sauvegardé avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde merchandising:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour sauvegarder la bio
app.post('/api/save-bio', authMiddleware, async (req, res) => {
  try {
    const bio = req.body;
    const filePath = path.join(PUBLIC_DIR, 'bio.json');
    
    await fs.writeFile(filePath, JSON.stringify(bio, null, 2));
    
    console.log('✅ Bio sauvegardée dans bio.json');
    res.json({ success: true, message: 'Bio sauvegardée avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde bio:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour uploader des images
app.post('/api/upload-image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Aucun fichier uploadé' });
    }

    const folder = sanitizeFolder(req.query.folder);
    if (!folder) {
      return res.status(400).json({ success: false, message: 'Dossier non autorisé' });
    }

    // Le type reel prime sur l'extension fournie par le client
    const realType = detectImageType(req.file.buffer);
    if (!realType) {
      return res.status(400).json({ success: false, message: "Le fichier n'est pas une image valide" });
    }
    const ext = safeExtension(req.file.originalname) || (realType === 'jpg' ? 'jpg' : realType);

    // Nom genere cote serveur : rien de l'entree client n'y survit
    const filename = `uploaded-${Date.now()}.${ext}`;

    const destDir = path.join(PUBLIC_DIR, folder);
    // Garde-fou : la destination resolue doit rester sous public/
    const resolved = path.resolve(destDir, filename);
    if (!resolved.startsWith(path.resolve(PUBLIC_DIR) + path.sep)) {
      return res.status(400).json({ success: false, message: 'Chemin invalide' });
    }

    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(resolved, req.file.buffer);

    const imagePath = `${folder}/${filename}`;
    console.log('✅ Image uploadée:', imagePath);
    res.json({
      success: true,
      imagePath: imagePath,
      message: 'Image uploadée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur upload image:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload' });
  }
});

// ============================================================
// STATS : dashboard /mm-admin/stats (refresh manuel + imports CSV)
//
// Le snapshot public va dans public/data/stats-public.json (versionne,
// affichable en prod). Les REVENUS Ditto vont dans data/stats-private.json,
// local uniquement (gitignore) : jamais servis par GitHub Pages.
// ============================================================

import { spawn } from 'child_process';
import { parseDitto, parseBandcamp, parseTikTok } from './scripts/csv-parsers.mjs';

const STATS_PUBLIC = path.join(PUBLIC_DIR, 'data', 'stats-public.json');
const STATS_PRIVATE = path.join(__dirname, 'data', 'stats-private.json');
const STATS_MANUAL_DIR = path.join(__dirname, 'data', 'stats-manual');

// Uploader dedie aux CSV : le multer "upload" existant est reserve aux
// images (fileFilter + magic bytes) et refuserait un text/csv.
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Refresh manuel : relance le collecteur (les cles viennent du .env local).
// Une seule execution a la fois.
let statsRunning = false;
app.post('/api/stats/refresh', authMiddleware, (req, res) => {
  if (statsRunning) {
    return res.status(409).json({ success: false, message: 'Un refresh est deja en cours' });
  }
  statsRunning = true;
  const child = spawn(process.execPath, [path.join(__dirname, 'scripts', 'fetch-stats.mjs')], {
    cwd: __dirname,
    env: process.env,
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  child.on('close', (code) => {
    statsRunning = false;
    console.log(`📊 Refresh stats termine (code ${code})`);
    res.json({ success: code === 0, log: log.slice(-2000) });
  });
});

// Revenus prives (Ditto) : lecture locale uniquement
app.get('/api/stats/private', authMiddleware, async (req, res) => {
  res.json(await readJsonSafe(STATS_PRIVATE, { dittoRevenue: [] }));
});

// Import CSV : ?type=ditto|bandcamp|tiktok, fichier en memoire, parse,
// integre au bloc manual du JSON public (les revenus partent en prive).
app.post('/api/stats/upload-csv', authMiddleware, uploadCsv.single('csv'), async (req, res) => {
  try {
    const type = String(req.query.type || '').toLowerCase();
    if (!['ditto', 'bandcamp', 'tiktok'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type invalide (ditto|bandcamp|tiktok)' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'aucun fichier' });
    }
    const text = req.file.buffer.toString('utf8');
    const importedAt = new Date().toISOString();

    // Copie source conservee en local (audit, re-parse eventuel)
    await fs.mkdir(STATS_MANUAL_DIR, { recursive: true });
    await fs.writeFile(path.join(STATS_MANUAL_DIR, `${type}-${importedAt.slice(0, 10)}.csv`), text);

    const pub = await readJsonSafe(STATS_PUBLIC, { snapshots: [], manual: {} });
    pub.manual = pub.manual || {};
    let recap = {};

    if (type === 'ditto') {
      const parsed = parseDitto(text);
      pub.manual.ditto = {
        importedAt,
        streamsByPlatform: parsed.streamsByPlatform,
        streamsByCountry: parsed.streamsByCountry,
      };
      // Revenus -> fichier prive local, jamais dans public/
      const priv = await readJsonSafe(STATS_PRIVATE, { dittoRevenue: [] });
      priv.dittoRevenue.push({
        importedAt,
        total: parsed.totalRevenue,
        currency: parsed.currency,
        byPlatform: parsed.revenueByPlatform,
        byCountry: parsed.revenueByCountry,
      });
      await fs.mkdir(path.dirname(STATS_PRIVATE), { recursive: true });
      await fs.writeFile(STATS_PRIVATE, JSON.stringify(priv, null, 2));
      recap = { rows: parsed.rowCount, warnings: parsed.warnings, revenue: 'enregistre en local uniquement' };
    } else if (type === 'bandcamp') {
      const parsed = parseBandcamp(text);
      pub.manual.bandcamp = { importedAt, plays: parsed.plays, sales: parsed.sales };
      recap = { rows: parsed.rowCount, warnings: parsed.warnings };
    } else {
      const parsed = parseTikTok(text);
      pub.manual.tiktok = {
        importedAt,
        followers: parsed.followers,
        videoViews: parsed.videoViews,
        profileViews: parsed.profileViews,
        likes: parsed.likes,
      };
      recap = { rows: parsed.rowCount, warnings: parsed.warnings };
    }

    await fs.mkdir(path.dirname(STATS_PUBLIC), { recursive: true });
    await fs.writeFile(STATS_PUBLIC, JSON.stringify(pub, null, 2) + '\n');
    console.log(`📊 CSV ${type} importe (${recap.rows} lignes)`);
    res.json({ success: true, type, ...recap });
  } catch (error) {
    console.error('❌ Erreur import CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
 * Panneau admin — tableau de bord (etape 2)
 * ============================================================ */

/** Lit un JSON du repo sans planter (null si absent/illisible). */
async function readJsonQuiet(rel) {
  try {
    return JSON.parse(await fs.readFile(path.join(__dirname, rel), 'utf8'));
  } catch {
    return null;
  }
}

/** Poids total d'un dossier (stat récursif, pas de lecture de contenu). */
function dirSize(rel) {
  const abs = path.join(__dirname, rel);
  if (!existsSync(abs)) return 0;
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(abs);
  return total;
}

/** Une image referencee par les donnees existe-t-elle dans public/ ? */
const publicFileExists = (rel) =>
  !!rel && existsSync(path.join(__dirname, 'public', String(rel).replace(/^\//, '')));

/**
 * Vue d'ensemble pour le tableau de bord : compteurs, sante des donnees,
 * medias. Tout est calcule cote serveur (fs), rien n'est modifie.
 */
app.get('/api/admin/summary', authMiddleware, async (req, res) => {
  try {
    const [disco, mixtapes, releases, events, mixes, store] = await Promise.all([
      readJsonQuiet('src/v2/data/discography.json'),
      readJsonQuiet('src/v2/data/mixtapes.json'),
      readJsonQuiet('public/releases.json'),
      readJsonQuiet('public/events.json'),
      readJsonQuiet('public/mixes.json'),
      readJsonQuiet('public/store.json'),
    ]);

    const tracks = disco?.tracks || [];
    const tracksNoSc = tracks.filter((t) => !t.soundcloudUrl);
    const tracksIncomplete = tracks.filter(
      (t) => !t.title || !t.project || !t.year || !t.link
    );

    const mxs = mixtapes?.mixtapes || [];
    const mixtapesNoArt = mxs.filter((m) => !publicFileExists(m.artwork));

    const rels = Array.isArray(releases) ? releases : releases?.releases || [];
    const releasesNoCover = rels.filter((r) => !publicFileExists(r.cover));

    const evts = Array.isArray(events) ? events : events?.events || [];
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = evts.filter((e) => String(e.date || '') >= today);

    // Images referencees introuvables (par domaine, en langage humain)
    const missingImages = [
      ...mixtapesNoArt.map((m) => `Mixtape ${m.number} : pochette introuvable`),
      ...releasesNoCover.map((r) => `Release « ${r.title} » : visuel introuvable`),
    ];

    res.json({
      success: true,
      counts: {
        tracks: tracks.length,
        tracksPlayable: tracks.length - tracksNoSc.length,
        tracksFeatured: tracks.filter((t) => t.featured).length,
        mixtapes: mxs.length,
        releases: rels.length,
        upcomingEvents: upcoming.length,
        pastEvents: evts.length - upcoming.length,
        mixes: Array.isArray(mixes) ? mixes.length : 0,
        storeItems: Array.isArray(store) ? store.length : 0,
      },
      health: {
        tracksWithoutPlayback: tracksNoSc.map((t) => t.title),
        tracksIncomplete: tracksIncomplete.map((t) => t.title),
        missingImages,
        pdfs: {
          presskit: existsSync(path.join(__dirname, 'public/Presskit_Maudite_Machine_2026.pdf')),
          riderEn: existsSync(path.join(__dirname, 'public/techrider-en.pdf')),
          riderFr: existsSync(path.join(__dirname, 'public/techrider-fr.pdf')),
        },
      },
      media: {
        imagesBytes: dirSize('public/images'),
        videosBytes: dirSize('public/videos'),
        eventsBytes: dirSize('public/events'),
      },
    });
  } catch (error) {
    console.error('❌ /api/admin/summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
 * Panneau admin — donnees editables (etape 3)
 * ============================================================ */

/**
 * Fichiers editables par l'admin : whitelist stricte + validateur par
 * fichier. Toute ecriture passe par un backup horodate dans
 * .admin-backups/ (gitignore, 20 versions par fichier) puis une ecriture
 * atomique (tmp + rename).
 */
const ADMIN_DATA_FILES = {
  discography: {
    path: 'src/v2/data/discography.json',
    validate(data) {
      if (!data || !Array.isArray(data.tracks)) return 'tracks manquant';
      for (const t of data.tracks) {
        if (!t.id || typeof t.id !== 'string') return `id manquant (${t.title || '?'})`;
        if (typeof t.title !== 'string') return 'title invalide';
        if (!['originals', 'remixes', 'vrstl'].includes(t.category)) {
          return `category invalide (${t.title})`;
        }
        if (t.soundcloudUrl && !/^https:\/\/soundcloud\.com\//.test(t.soundcloudUrl)) {
          return `soundcloudUrl invalide (${t.title})`;
        }
      }
      const ids = data.tracks.map((t) => t.id);
      if (new Set(ids).size !== ids.length) return 'ids en double';
      return null;
    },
  },
  mixtapes: {
    path: 'src/v2/data/mixtapes.json',
    validate(data) {
      if (!data || !Array.isArray(data.mixtapes)) return 'mixtapes manquant';
      for (const m of data.mixtapes) {
        if (typeof m.title !== 'string' || !m.title) return 'title manquant';
        if (!Number.isFinite(m.number)) return `number invalide (${m.title})`;
        if (!/^https:\/\/soundcloud\.com\//.test(m.soundcloudUrl || '')) {
          return `soundcloudUrl invalide (${m.title})`;
        }
      }
      return null;
    },
  },
};

const BACKUPS_DIR = path.join(__dirname, '.admin-backups');

async function backupDataFile(name, absPath) {
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    await fs.copyFile(absPath, path.join(BACKUPS_DIR, `${name}.${stamp}.json`));
  } catch {
    return; // fichier source absent : rien a sauvegarder
  }
  // Rotation : 20 versions par fichier
  const all = (await fs.readdir(BACKUPS_DIR))
    .filter((f) => f.startsWith(`${name}.`))
    .sort();
  for (const old of all.slice(0, Math.max(0, all.length - 20))) {
    await fs.unlink(path.join(BACKUPS_DIR, old)).catch(() => {});
  }
}

app.get('/api/admin/data/:name', authMiddleware, async (req, res) => {
  const entry = ADMIN_DATA_FILES[req.params.name];
  if (!entry) return res.status(404).json({ success: false, message: 'Fichier inconnu' });
  try {
    const data = JSON.parse(await fs.readFile(path.join(__dirname, entry.path), 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/data/:name', authMiddleware, async (req, res) => {
  const entry = ADMIN_DATA_FILES[req.params.name];
  if (!entry) return res.status(404).json({ success: false, message: 'Fichier inconnu' });
  const problem = entry.validate(req.body);
  if (problem) return res.status(400).json({ success: false, message: problem });
  try {
    const abs = path.join(__dirname, entry.path);
    await backupDataFile(req.params.name, abs);
    const tmp = `${abs}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(req.body, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, abs);
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ PUT data/${req.params.name}:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Une URL SoundCloud repond-elle encore ? oEmbed public : 200 = lisible,
 * 403/404 = privee ou morte. Zero cle.
 */
app.post('/api/admin/sc-check', authMiddleware, async (req, res) => {
  const { url } = req.body || {};
  if (!/^https:\/\/soundcloud\.com\//.test(url || '')) {
    return res.status(400).json({ success: false, message: 'URL SoundCloud attendue' });
  }
  try {
    const r = await fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    res.json({ success: true, ok: r.ok, status: r.status });
  } catch {
    res.json({ success: true, ok: false, status: 0 });
  }
});

/**
 * Extraction SoundCloud pour les mixtapes : titre, duree, annee et artwork
 * (telecharge en WebP 500px local via sharp). Meme mecanisme d'hydration
 * que les imports faits a la main dans les sessions precedentes.
 */
app.post('/api/admin/sc-extract', authMiddleware, async (req, res) => {
  const { url } = req.body || {};
  if (!/^https:\/\/soundcloud\.com\/[\w-]+\/[\w-]+/.test(url || '')) {
    return res.status(400).json({ success: false, message: 'URL de track SoundCloud attendue' });
  }
  try {
    const page = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!page.ok) {
      return res.status(404).json({ success: false, message: `SoundCloud repond ${page.status}` });
    }
    const html = await page.text();
    const m = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/s);
    const sound = m ? JSON.parse(m[1]).find((h) => h.hydratable === 'sound') : null;
    const d = sound?.data;
    if (!d) return res.status(422).json({ success: false, message: 'Page illisible (hydration absente)' });

    const ms = d.duration || 0;
    const h = Math.floor(ms / 3600000);
    const mn = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const duration = `${h ? h + ':' + String(mn).padStart(2, '0') : mn}:${String(s).padStart(2, '0')}`;
    const year = Number(String(d.display_date || d.created_at || '').slice(0, 4)) || null;
    const numberMatch = String(d.title || '').match(/(\d{2,3})/);

    // Artwork : t500x500 -> WebP local (public/images/mixtapes/)
    let artwork = null;
    if (d.artwork_url) {
      const artUrl = d.artwork_url.replace('-large.', '-t500x500.');
      const img = await fetch(artUrl, { signal: AbortSignal.timeout(12000) });
      if (img.ok) {
        const buf = Buffer.from(await img.arrayBuffer());
        const slug = (numberMatch ? `mixtape-${numberMatch[1]}` : `mixtape-${Date.now()}`);
        const rel = `images/mixtapes/${slug}.webp`;
        const { default: sharp } = await import('sharp');
        await fs.mkdir(path.join(__dirname, 'public/images/mixtapes'), { recursive: true });
        await sharp(buf).resize(500, 500, { fit: 'inside' }).webp({ quality: 78 }).toFile(
          path.join(__dirname, 'public', rel)
        );
        artwork = `/${rel}`;
      }
    }

    res.json({
      success: true,
      extracted: {
        title: String(d.title || ''),
        number: numberMatch ? Number(numberMatch[1]) : null,
        year,
        duration,
        soundcloudUrl: String(d.permalink_url || url),
        artwork,
      },
    });
  } catch (error) {
    console.error('❌ sc-extract:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** git/gh en lecture seule, avec timeout court et repli silencieux. */
async function runQuiet(cmd, args, timeout = 5000) {
  try {
    const { stdout } = await execFileAsync(cmd, args, { cwd: __dirname, timeout });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Etat de publication pour le tableau de bord : branche, fichiers modifies
 * non publies, dernier commit, statut du dernier deploiement Pages.
 * Lecture seule (le bouton Publier arrive a l'etape 5).
 */
/**
 * Audit SEO : lit index.html (la source des balises), le sitemap, le
 * robots.txt et le dernier snapshot de stats, puis renvoie un bilan
 * en langage humain pour la page /mm-admin/seo. Lecture seule.
 */
app.get('/api/admin/seo', authMiddleware, async (req, res) => {
  try {
    const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf8');
    const pick = (re) => (html.match(re) || [])[1] || null;

    const title = pick(/<title>([^<]*)<\/title>/);
    const description = pick(/name="description" content="([^"]*)"/);
    const keywords = pick(/name="keywords" content="([^"]*)"/);
    const ogImage = pick(/property="og:image"\s+content="([^"]*)"/);

    // JSON-LD : on verifie les signaux de booking local
    let ld = null;
    try {
      ld = JSON.parse((html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]);
    } catch {}
    const musicGroup = Array.isArray(ld) ? ld.find((x) => x['@type'] === 'MusicGroup') : null;

    let sitemapUrls = [];
    try {
      const sm = await fs.readFile(path.join(__dirname, 'public', 'sitemap.xml'), 'utf8');
      sitemapUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    } catch {}

    let robotsOk = false;
    try {
      const rb = await fs.readFile(path.join(__dirname, 'public', 'robots.txt'), 'utf8');
      robotsOk = rb.includes('Sitemap:');
    } catch {}

    // Analytics : la balise vit dans index.html
    const ga4 = (html.match(/G-[A-Z0-9]{8,}/) || [])[0] || null;
    const fbPixel = /fbq\('init'/.test(html);

    // Donnees de visite : dernier snapshot du collecteur
    let visits = null;
    try {
      const stats = JSON.parse(await fs.readFile(path.join(__dirname, 'public', 'data', 'stats-public.json'), 'utf8'));
      const last = (stats.snapshots || []).slice(-1)[0];
      if (last && last.ga4 && last.ga4.status === 'ok') visits = last.ga4;
      else if (last && last.ga4) visits = { status: last.ga4.status, reason: last.ga4.reason || null };
    } catch {}

    // Verifications, formulees pour un humain
    const checks = [
      {
        key: 'title',
        label: 'Titre du site',
        ok: !!title && /montr[ée]al/i.test(title),
        detail: title || 'absent',
        why: `Le titre est la premiere chose que Google affiche. Contenir "Montreal" aide a sortir sur "DJ Montreal".`,
      },
      {
        key: 'description',
        label: 'Description',
        ok: !!description && description.length > 80 && description.length < 320,
        detail: description ? description.slice(0, 160) + (description.length > 160 ? '…' : '') : 'absente',
        why: 'Le texte affiche sous le titre dans Google. Entre 80 et 320 caracteres.',
      },
      {
        key: 'localBusiness',
        label: 'Zones desservies (booking local)',
        ok: !!(musicGroup && musicGroup.areaServed),
        detail: musicGroup && musicGroup.areaServed
          ? musicGroup.areaServed.map((a) => a.name).join(', ')
          : 'non declarees',
        why: 'Indique a Google les villes ou tu es disponible pour jouer.',
      },
      {
        key: 'offer',
        label: 'Service DJ declare',
        ok: !!(musicGroup && musicGroup.makesOffer),
        detail: musicGroup && musicGroup.makesOffer
          ? musicGroup.makesOffer.itemOffered.name
          : 'non declare',
        why: 'Permet a Google de comprendre que tu proposes des prestations.',
      },
      {
        key: 'socials',
        label: 'Reseaux sociaux lies',
        ok: !!(musicGroup && (musicGroup.sameAs || []).length >= 10),
        detail: musicGroup ? (musicGroup.sameAs || []).length + ' profils' : '0',
        why: 'Relie le site a tes profils : Google recoupe et te reconnait.',
      },
      {
        key: 'sitemap',
        label: 'Plan du site',
        ok: sitemapUrls.length > 0,
        detail: sitemapUrls.length + ' page(s) : ' + sitemapUrls.map((u) => u.replace('https://mauditemachine.com', '') || '/').join(', '),
        why: 'La liste des pages a indexer, a soumettre dans Search Console.',
      },
      {
        key: 'robots',
        label: 'Fichier robots',
        ok: robotsOk,
        detail: robotsOk ? 'present, plan du site declare' : 'plan du site non declare',
        why: 'Autorise les moteurs et leur indique le plan du site.',
      },
      {
        key: 'analytics',
        label: 'Mesure d audience',
        ok: !!ga4,
        detail: ga4 ? 'Google Analytics actif (' + ga4 + ')' + (fbPixel ? ' + pixel Facebook' : '') : 'absente',
        why: 'Sans mesure, impossible de savoir qui visite le site.',
      },
    ];

    res.json({
      success: true,
      title,
      description,
      keywords: keywords ? keywords.split(',').map((k) => k.trim()) : [],
      ogImage,
      checks,
      score: checks.filter((c) => c.ok).length,
      total: checks.length,
      visits,
      sitemapUrls,
    });
  } catch (error) {
    console.error('❌ /api/admin/seo:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/admin/git/status', authMiddleware, async (req, res) => {
  try {
    const [branch, porcelain, lastCommit, ghRun] = await Promise.all([
      runQuiet('git', ['branch', '--show-current']),
      runQuiet('git', ['status', '--porcelain']),
      runQuiet('git', ['log', '-1', '--format=%cr|%s']),
      runQuiet('gh', [
        'run', 'list', '--workflow=pages.yml', '--limit', '1',
        '--json', 'status,conclusion,updatedAt',
      ], 8000),
    ]);

    // Format porcelain : 2 colonnes d'etat puis le chemin ; le nombre
    // d'espaces varie selon l'etat, slice(2).trim() couvre tous les cas.
    const changedFiles = (porcelain || '')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(2).trim());

    let deploy = null;
    if (ghRun) {
      try {
        const run = JSON.parse(ghRun)[0];
        if (run) deploy = { status: run.status, conclusion: run.conclusion, at: run.updatedAt };
      } catch {
        /* gh absent ou sortie inattendue : le front affichera un lien Actions */
      }
    }

    const [last = '', ...msgParts] = (lastCommit || '').split('|');
    res.json({
      success: true,
      branch: branch || 'main',
      changedFiles,
      lastCommit: lastCommit ? { when: last, message: msgParts.join('|') } : null,
      deploy,
    });
  } catch (error) {
    console.error('❌ /api/admin/git/status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const HOST = LAN_MODE ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur API démarré sur http://localhost:${PORT}${LAN_MODE ? ' (mode LAN : accessible sur le réseau local, mot de passe exigé)' : ''}`);
  console.log('📁 Fichiers JSON mis à jour automatiquement dans public/');
  console.log('📸 Upload d\'images disponible sur /api/upload-image');
  console.log('📊 Stats : /api/stats/refresh, /api/stats/upload-csv, /api/stats/private');
});
