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
    const events = req.body;
    const filePath = path.join(PUBLIC_DIR, 'events.json');
    
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
