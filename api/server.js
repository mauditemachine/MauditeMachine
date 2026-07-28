/**
 * ============================================================
 * NON DEPLOYE. CE SERVEUR NE TOURNE NULLE PART.
 * ============================================================
 *
 * Ce fichier ciblait un hebergement Render qui n'a jamais existe :
 * le sous-domaine attendu renvoyait `x-render-routing: no-server`,
 * c'est a dire aucun service derriere. Render a ete abandonne pour
 * ce projet, et api/render.yaml (un blueprint jamais applique, qui
 * laissait croire au contraire) a ete supprime.
 *
 * Consequence : l'admin en ligne est desactive par conception.
 * VITE_API_URL est volontairement absente de .env.production, et
 * AdminGate affiche un ecran explicite au lieu d'un login inutile.
 *
 * Le circuit d'edition reel est decrit dans le README, section
 * "Mettre a jour les releases (page /radar)".
 *
 * Le code est conserve, pas supprime : il reste la base pret-a-l'emploi
 * si un hebergement d'ecriture est remis en place un jour. Il embarque
 * deja l'auth server-side (timingSafeEqual, rate-limit, fail closed) et
 * l'upload durci (whitelist, basename sur, magic bytes).
 * Pour l'admin en local, c'est server.js a la racine qui sert, pas celui-ci.
 */

import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

const app = express();
const PORT = process.env.PORT || 3002;

// Config from environment variables.
// IMPORTANT : aucune de ces variables ne doit jamais etre prefixee VITE_,
// sinon Vite l'inline dans le bundle front, qui est public.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'mauditemachine/MauditeMachine';
// ADMIN_PASSWORD est le nom privilegie ; ADMIN_API_KEY reste accepte pour
// ne pas casser la config Render deja en place.
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://mauditemachine.com';

app.use(
  cors({
    origin: [ALLOWED_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'],
    // Le front envoie le secret saisi par l'admin dans l'un de ces headers
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '50mb' }));

if (!ADMIN_SECRET) {
  console.warn('[SECURITE] ADMIN_PASSWORD non defini : toutes les routes d\'ecriture repondront 401.');
}

/**
 * Comparaison a temps constant. Les deux valeurs sont hashees en SHA-256
 * avant comparaison pour garantir des buffers de meme longueur (prerequis
 * de timingSafeEqual) et ne pas fuiter la longueur du secret.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Extrait le secret depuis Authorization: Bearer <secret> ou x-api-key. */
function extractSecret(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const legacy = req.headers['x-api-key'];
  return typeof legacy === 'string' ? legacy : '';
}

// Anti-brute-force : fenetre glissante en memoire, par IP.
// Suffisant ici (instance unique Render, pas de cluster).
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const attempts = new Map(); // ip -> { count, firstAt }

function tooManyAttempts(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function registerFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: Date.now() });
  } else {
    rec.count += 1;
  }
}

// Purge periodique des entrees expirees (evite la fuite memoire)
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attempts) {
    if (now - rec.firstAt > WINDOW_MS) attempts.delete(ip);
  }
}, WINDOW_MS).unref?.();

/**
 * Verrou serveur sur toutes les routes d'ecriture.
 * Fail closed : si ADMIN_SECRET n'est pas configure, tout est refuse.
 */
function authMiddleware(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  if (tooManyAttempts(ip)) {
    return res.status(429).json({ success: false, message: 'Too many attempts, retry later' });
  }
  if (!ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!safeEqual(extractSecret(req), ADMIN_SECRET)) {
    registerFailure(ip);
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  attempts.delete(ip);
  next();
}

// Verification du secret pour l'ecran de login admin.
// Ne fait aucune ecriture : permet au front de valider sans tenter un save a blanc.
app.post('/api/auth', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'Authenticated' });
});

// GitHub API helper: get file (returns sha + content)
async function getGitHubFile(filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  return res.json();
}

// GitHub API helper: create or update a file
async function updateGitHubFile(filePath, content, message) {
  const existing = await getGitHubFile(filePath);
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: 'main',
  };
  if (existing) body.sha = existing.sha;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} - ${err}`);
  }
  return res.json();
}

// GitHub API helper: upload binary file (base64)
async function uploadGitHubBinary(filePath, base64Data, message) {
  const existing = await getGitHubFile(filePath);
  const body = {
    message,
    content: base64Data,
    branch: 'main',
  };
  if (existing) body.sha = existing.sha;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} - ${err}`);
  }
  return res.json();
}

// Save events
app.post('/api/save-events', authMiddleware, async (req, res) => {
  try {
    const events = req.body;
    const content = JSON.stringify(events, null, 2);
    await updateGitHubFile('public/events.json', content, 'Update events from admin panel');
    console.log('Events saved to GitHub');
    res.json({ success: true, message: 'Events saved & deploy triggered' });
  } catch (error) {
    console.error('Save events error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save messages
app.post('/api/save-messages', authMiddleware, async (req, res) => {
  try {
    const messages = req.body;
    const content = JSON.stringify(messages, null, 2);
    await updateGitHubFile('public/messages.json', content, 'Update messages from admin panel');
    console.log('Messages saved to GitHub');
    res.json({ success: true, message: 'Messages saved & deploy triggered' });
  } catch (error) {
    console.error('Save messages error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save merch
app.post('/api/save-merch', authMiddleware, async (req, res) => {
  try {
    const merchItems = req.body;
    const content = JSON.stringify(merchItems, null, 2);
    await updateGitHubFile('public/store.json', content, 'Update store from admin panel');
    console.log('Merch saved to GitHub');
    res.json({ success: true, message: 'Store saved & deploy triggered' });
  } catch (error) {
    console.error('Save merch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save releases (Radar / veille musicale)
app.post('/api/save-releases', authMiddleware, async (req, res) => {
  try {
    const releases = req.body;
    if (!Array.isArray(releases)) {
      return res.status(400).json({ success: false, message: 'Body must be an array' });
    }
    const content = JSON.stringify(releases, null, 2);
    await updateGitHubFile('public/releases.json', content, 'Update releases from admin panel');
    console.log('Releases saved to GitHub');
    res.json({ success: true, message: 'Releases saved & deploy triggered' });
  } catch (error) {
    console.error('Save releases error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// UPLOAD : validation stricte
// Sans ces gardes, `folder` et `filename` etaient concatenes bruts dans
// `public/${folder}/${filename}` : un folder="../../.github/workflows" et
// un filename="evil.yml" permettaient d'ecrire un workflow GitHub Actions
// arbitraire dans le repo, donc une execution de code sur le CI.
// ============================================================

// Liste fermee. 'images' et 'events' sont les seuls utilises par l'admin ;
// les deux autres sont prevus pour les visuels goodies / releases.
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

/**
 * Reduit a un basename sur : pas de separateur, pas de '..', pas de
 * caractere hors [a-zA-Z0-9._-], extension image obligatoire.
 */
function sanitizeFilename(name) {
  const raw = String(name ?? '');
  // Coupe tout composant de chemin (POSIX et Windows)
  const base = raw.split(/[/\\]/).pop() || '';
  if (!base || base === '.' || base === '..') return null;
  if (base.includes('..')) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
  const ext = (base.match(/\.([a-zA-Z0-9]+)$/) || [])[1];
  if (!ext || !ALLOWED_IMAGE_EXT.has(ext.toLowerCase())) return null;
  return base;
}

/**
 * Detecte le type reel par magic bytes. Le Content-Type et l'extension
 * sont fournis par le client : ils ne prouvent rien.
 */
function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// Upload image
app.post('/api/upload-image', authMiddleware, async (req, res) => {
  try {
    const { base64, filename, folder } = req.body;
    if (!base64 || !filename) {
      return res.status(400).json({ success: false, message: 'Missing base64 or filename' });
    }

    const targetFolder = sanitizeFolder(folder);
    if (!targetFolder) {
      return res.status(400).json({ success: false, message: 'Invalid folder' });
    }

    const safeName = sanitizeFilename(filename);
    if (!safeName) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }

    // Strip data URI prefix if present
    const cleanBase64 = String(base64).replace(/^data:image\/\w+;base64,/, '');

    let buf;
    try {
      buf = Buffer.from(cleanBase64, 'base64');
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid base64' });
    }
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Invalid size (max 10MB)' });
    }
    if (!detectImageType(buf)) {
      return res.status(400).json({ success: false, message: 'File is not a valid image' });
    }

    const filePath = `public/${targetFolder}/${safeName}`;
    await uploadGitHubBinary(filePath, cleanBase64, `Upload image: ${safeName}`);
    console.log('Image uploaded to GitHub:', filePath);
    res.json({
      success: true,
      imagePath: `${targetFolder}/${safeName}`,
      message: 'Image uploaded & deploy triggered',
    });
  } catch (error) {
    console.error('Upload image error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', repo: GITHUB_REPO });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`GitHub repo: ${GITHUB_REPO}`);
});
