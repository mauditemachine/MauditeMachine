/**
 * Les samples du MM-RYTM dans l'admin local (2026-10-18, Mika, apres
 * npm run samples:mika : "c'est vraiment une bonne idee, je veux voir les
 * samples dans l'app") : les routes de server.js pour la page
 * /mm-admin/samples. Toutes derriere authMiddleware (le mot de passe de
 * l'admin, exige en mode reseau local).
 *
 *   GET  /api/admin/samples/scan          l'analyse (scripts/ableton-samples.mjs, scan) : la derniere,
 *                                         ou lancee si aucune ; ?refresh=1 la refait. Repond tout de
 *                                         suite : state 'running' avec l'etape tant qu'elle tourne
 *                                         (la page redemande), puis 'done' avec le resultat.
 *   GET  /api/admin/samples/preview?id=   un candidat a ecouter : l'identifiant d'un fichier de la
 *                                         derniere analyse, jamais un chemin ; seulement sous shots
 *                                         (chemins reels : un lien vers ailleurs est refuse) ; un AIFF
 *                                         converti en WAV (afconvert, garde dans un dossier
 *                                         temporaire) ou 415 ; Range accepte (HEAD aussi).
 *   POST /api/admin/samples/publish       { picks: { bd: [id...], ... }, resetSamples?: true } :
 *                                         l'ajout de ces seuls samples, commit, push (publish) ; rend
 *                                         avant -> apres par voix, le commit, la ligne pour annuler,
 *                                         ou le texte du refus.
 *
 * Rien du navigateur n'atteint un chemin, une commande ou git : des
 * identifiants verifies (16 caracteres hexadecimaux) et un booleen ; les
 * programmes partent avec des listes d'arguments, sans shell. Une seule
 * analyse ou publication a la fois. Le dernier resultat d'une publication
 * reste en memoire : en dev, vite recharge la page des que des samples
 * arrivent dans public/samples/rytm (le module virtuel de la liste), la page
 * rechargee le retrouve ici.
 */

import { createReadStream, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = /^[0-9a-f]{16}$/;
const FAMILIES = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
/** Au-dela, ce n'est plus un coup de batterie a ecouter. */
const MAX_PREVIEW = 64 * 1024 * 1024;
const TYPES = { wav: 'audio/wav', mp3: 'audio/mpeg', flac: 'audio/flac', m4a: 'audio/mp4', aiff: 'audio/aiff' };
/** Les WAV d'ecoute des AIFF : un dossier propre a ce depot, vide au demarrage du serveur et a sa sortie. */
const PREVIEW_DIR = path.join(os.tmpdir(), `mm-admin-samples-${crypto.createHash('sha1').update(ROOT).digest('hex').slice(0, 8)}`);
const MAX_PREVIEW_FILES = 300;
const MAX_LOG = 2000;

/** Les scripts, charges a la premiere demande (le serveur demarre sans eux). */
let mods = null;
async function load() {
  if (!mods) {
    const [pipeline, lib] = await Promise.all([import('./ableton-samples.mjs'), import('./rytm-samples-lib.mjs')]);
    mods = { pipeline, lib };
  }
  return mods;
}

const state = {
  /** L'analyse ou la publication en cours : { kind, started, progress, log }. */
  job: null,
  /** La derniere analyse (ce que la page recoit), et ses fichiers : identifiant -> chemin (jamais envoye). */
  scan: null,
  files: new Map(),
  /** Une analyse qui n'a pas pu se faire : son message, et les samples du site quand meme. */
  error: null,
  /** La derniere publication (la page rechargee par vite la retrouve). */
  lastPublish: null,
};

const pushLine = (log, line) => {
  log.push(line);
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
};

function resetPreviewDir() {
  rmSync(PREVIEW_DIR, { recursive: true, force: true });
  mkdirSync(PREVIEW_DIR, { recursive: true });
}

function startScan() {
  const job = { kind: 'scan', started: Date.now(), progress: { phase: 'start' }, log: [] };
  state.job = job;
  (async () => {
    const { pipeline, lib } = await load();
    lib.clearConverted();
    // Les samples du site tout de suite (rapide) : la page les montre pendant l'analyse
    job.site = await pipeline.siteView().then((v) => v.families, () => null);
    const io = {
      log: (...a) => pushLine(job.log, a.join(' ')),
      error: (...a) => pushLine(job.log, a.join(' ')),
      progress: (p) => {
        job.progress = p;
      },
      inherit: false,
    };
    try {
      const { files, ...view } = await pipeline.scan({}, { io });
      state.scan = view;
      state.files = files;
      state.error = null;
    } catch (e) {
      const site = await pipeline.siteView().catch(() => null);
      state.scan = null;
      state.files = new Map();
      state.error = {
        kind: e instanceof pipeline.Stop ? e.kind : 'crash',
        message: e instanceof pipeline.Stop ? e.lines.join('\n') || e.message : `L'analyse a plante : ${e.message}`,
        shots: pipeline.defaults().shots,
        site,
      };
      if (!(e instanceof pipeline.Stop)) console.error('[samples] analyse :', e);
    }
  })()
    .catch((e) => {
      state.error = { kind: 'crash', message: `L'analyse a plante : ${e.message}`, shots: null, site: null };
      console.error('[samples] analyse :', e);
    })
    .finally(() => {
      if (state.job === job) state.job = null;
    });
}

const jobView = (job) => job && { kind: job.kind, started: job.started, elapsed: Date.now() - job.started, progress: job.progress };

/** Les 12 premiers octets d'un fichier. */
async function head(full) {
  const fh = await open(full, 'r');
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fh.read(buf, 0, 12, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/** Un fichier (ou un morceau, Range) avec son type ; HEAD : les en-tetes seuls. */
async function sendFile(req, res, file, type) {
  const st = await stat(file);
  const size = st.size;
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // La page (une autre origine : le port de vite) peut lire ces en-tetes
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length');
  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = typeof req.headers.range === 'string' ? req.headers.range.trim() : '';
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') start = Math.max(0, size - Number(m[2]));
      else {
        start = Number(m[1]);
        if (m[2] !== '') end = Math.min(Number(m[2]), size - 1);
      }
      if (start > end || start >= size) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      status = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
  }
  res.setHeader('Content-Length', String(Math.max(0, end - start + 1)));
  res.status(status);
  if (req.method === 'HEAD' || size === 0) return res.end();
  createReadStream(file, { start, end })
    .on('error', () => res.destroy())
    .pipe(res);
}

/**
 * Le dossier des WAV d'ecoute, vide a la premiere conversion de ce serveur
 * et efface a sa sortie : un second lancement (refuse sur le port deja pris)
 * ne touche pas a celui du premier. Il revient s'il a disparu (macOS nettoie
 * le dossier temporaire).
 */
let previewReady = false;
function previewDir() {
  if (!previewReady) {
    previewReady = true;
    resetPreviewDir();
    process.on('exit', () => rmSync(PREVIEW_DIR, { recursive: true, force: true }));
  }
  mkdirSync(PREVIEW_DIR, { recursive: true });
  if (readdirSync(PREVIEW_DIR).length >= MAX_PREVIEW_FILES) resetPreviewDir();
  return PREVIEW_DIR;
}

export function registerSamplesRoutes(app, authMiddleware) {
  // npm run admin s'arrete par Ctrl+C (scripts/dev-admin.mjs envoie SIGTERM) : une sortie propre, pour que les
  // dossiers temporaires (WAV d'ecoute, AIFF convertis) partent avec le serveur au lieu de rester dans le dossier temporaire
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => process.exit(0));


  app.get('/api/admin/samples/scan', authMiddleware, (req, res) => {
    const refresh = req.query.refresh === '1';
    if (!state.job && (refresh || (!state.scan && !state.error))) startScan();
    const running = Boolean(state.job);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      state: running ? 'running' : state.scan ? 'done' : state.error ? 'error' : 'idle',
      job: jobView(state.job),
      scan: running ? null : state.scan,
      error: running ? null : state.error,
      site: running ? state.job.site ?? null : null,
      lastPublish: state.lastPublish,
    });
  });

  app.get('/api/admin/samples/preview', authMiddleware, async (req, res) => {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (!ID.test(id)) return res.status(400).json({ success: false, message: 'Identifiant de sample invalide.' });
      const f = state.files.get(id);
      if (!f || !state.scan) return res.status(404).json({ success: false, message: "Ce sample n'est pas dans la dernière analyse : clique sur Re-analyser." });
      if (f.placeholder) return res.status(409).json({ success: false, message: "Pas encore téléchargé d'iCloud : télécharge-le dans le Finder, puis Re-analyser." });
      let real;
      let shotsReal;
      try {
        real = await realpath(f.full);
        shotsReal = await realpath(state.scan.shots.path);
      } catch {
        return res.status(404).json({ success: false, message: "Fichier introuvable (déplacé ou supprimé depuis l'analyse ?)." });
      }
      // Seulement ce qui est vraiment sous shots : un lien vers un fichier d'ailleurs ne sort pas
      if (!real.startsWith(shotsReal + path.sep)) return res.status(403).json({ success: false, message: "Refusé : ce fichier n'est pas dans le dossier shots." });
      const st = await stat(real);
      if (!st.isFile()) return res.status(404).json({ success: false, message: "Ce n'est pas un fichier." });
      if (st.size > MAX_PREVIEW) return res.status(413).json({ success: false, message: 'Fichier trop gros pour une écoute.' });
      const { lib } = await load();
      const kind = lib.audioKind(await head(real));
      if (!kind) return res.status(415).json({ success: false, message: "Pas un fichier audio lisible (vide, coupé, ou juste l'extension)." });
      if (kind !== 'aiff') return sendFile(req, res, real, TYPES[kind]);
      // AIFF : Chrome et Firefox ne le lisent pas ; afconvert (macOS) en fait un WAV, garde pour la prochaine ecoute
      if (!lib.AFCONVERT) {
        return res.status(415).json({ success: false, message: "AIFF : ton navigateur ne le lit pas, et afconvert (macOS) n'est pas là pour le convertir en WAV. Écoute-le depuis l'admin sur ton Mac." });
      }
      const key = crypto.createHash('sha1').update(`${id}:${st.size}:${st.mtimeMs}`).digest('hex').slice(0, 16);
      const out = path.join(PREVIEW_DIR, `${key}.wav`);
      const cached = previewReady ? await stat(out).catch(() => null) : null;
      if (!cached?.size) {
        previewDir();
        try {
          lib.aiffToWav(real, out);
        } catch (e) {
          rmSync(out, { force: true });
          return res.status(415).json({ success: false, message: `AIFF : la conversion en WAV a échoué (${e.message}).` });
        }
      }
      return sendFile(req, res, out, 'audio/wav');
    } catch (e) {
      console.error('[samples] ecoute :', e);
      if (!res.headersSent) res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/admin/samples/publish', authMiddleware, async (req, res) => {
    if (state.job) {
      return res.status(409).json({ success: false, message: state.job.kind === 'publish' ? 'Une publication est déjà en cours.' : "Une analyse est en cours : attends qu'elle finisse, puis publie." });
    }
    // Le corps : des identifiants par voix, et un booleen ; rien d'autre
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
    const bad = (message) => res.status(400).json({ success: false, message });
    if (!body) return bad('Corps attendu : { picks: { bd: [...], ... } }.');
    if (Object.keys(body).some((k) => k !== 'picks' && k !== 'resetSamples')) return bad('Champ inattendu.');
    if (body.resetSamples !== undefined && typeof body.resetSamples !== 'boolean') return bad('resetSamples : vrai ou faux.');
    const picks = body.picks;
    if (!picks || typeof picks !== 'object' || Array.isArray(picks)) return bad('picks attendu.');
    for (const [fam, ids] of Object.entries(picks)) {
      if (!FAMILIES.includes(fam)) return bad(`Voix inconnue : ${String(fam).slice(0, 20)}.`);
      if (!Array.isArray(ids) || ids.length > 200 || ids.some((id) => typeof id !== 'string' || !ID.test(id))) return bad(`${fam} : identifiants invalides.`);
    }
    const job = { kind: 'publish', started: Date.now(), progress: { phase: 'preflight' }, log: [] };
    state.job = job;
    const say = (...a) => {
      const line = a.join(' ');
      pushLine(job.log, line);
      console.log(`[samples] ${line}`);
    };
    let result;
    try {
      const { pipeline, lib } = await load();
      lib.clearConverted();
      const io = {
        log: say,
        error: say,
        progress: (p) => {
          job.progress = p;
        },
        inherit: false,
      };
      const r = await pipeline.publish(picks, { resetSamples: body.resetSamples === true }, { io });
      result = { ...r, at: new Date().toISOString(), log: job.log.slice(-400) };
      state.lastPublish = result;
      res.json({ success: true, result });
    } catch (e) {
      console.error('[samples] publication :', e);
      result = { ok: false, error: e.message, at: new Date().toISOString(), log: job.log.slice(-400) };
      state.lastPublish = result;
      res.status(500).json({ success: false, message: e.message, result });
    } finally {
      if (state.job === job) state.job = null;
      // Le site a change (ou a ete remis comme en ligne) : l'analyse d'avant ne dit plus vrai
      if (result && (result.ok || result.commit || result.reset)) startScan();
    }
  });
}
