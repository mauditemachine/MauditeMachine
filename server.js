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

const eventKey = (date, title) =>
  `${String(date ?? '').slice(0, 10)}|${String(title ?? '').trim().toLowerCase()}`;

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
  const known = new Map();
  for (const ev of previous) {
    if (ev?.image && !isRemoteImage(ev.image)) {
      known.set(eventKey(ev.date, ev.title), ev.image);
    }
  }

  const out = [];
  for (const ev of events) {
    if (!ev || !isRemoteImage(ev.image)) {
      out.push(ev);
      continue;
    }
    const local =
      known.get(eventKey(ev.date, ev.title)) || (await downloadSanityImage(ev.image, ev.title));
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

app.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur http://localhost:${PORT}`);
  console.log('📁 Fichiers JSON mis à jour automatiquement dans public/');
  console.log('📸 Upload d\'images disponible sur /api/upload-image');
});
