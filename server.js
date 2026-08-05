import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import multer from 'multer';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Secret optionnel en local (ADMIN_PASSWORD ou ADMIN_API_KEY, jamais VITE_*).
// S'il est defini, il est exige comme en production.
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY || '';

// CORS restreint aux origines de dev.
// Avant : app.use(cors()) acceptait TOUTES les origines, donc n'importe quel
// site ouvert dans le navigateur pouvait ecrire dans les JSON locaux pendant
// que ce serveur tournait.
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    methods: ['GET', 'POST', 'OPTIONS'],
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

app.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur http://localhost:${PORT}`);
  console.log('📁 Fichiers JSON mis à jour automatiquement dans public/');
  console.log('📸 Upload d\'images disponible sur /api/upload-image');
  console.log('📊 Stats : /api/stats/refresh, /api/stats/upload-csv, /api/stats/private');
});
