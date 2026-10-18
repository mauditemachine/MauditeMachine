/**
 * Page Samples (2026-10-18, Mika, apres npm run samples:mika : "c'est
 * vraiment une bonne idee, je veux voir les samples dans l'app") : les
 * samples du MM-RYTM voix par voix. Ceux du site, et ceux de ses projets
 * Ableton (l'analyse de scripts/ableton-samples.mjs, servie par server.js :
 * scripts/admin-samples-api.mjs), classes du plus joue au moins joue, a
 * ecouter, a cocher, puis a publier (ajout apres les numeros deja la, commit,
 * push). Le choix automatique de la commande est coche d'avance.
 *
 * L'ecoute : jamais sans un clic, un seul son a la fois (un clic sur un
 * autre coupe le precedent, un second clic sur le meme l'arrete). Un
 * candidat vient de server.js avec le mot de passe (un <audio> ne sait pas
 * envoyer d'en-tete : fetch, puis un blob) ; un sample du site est un
 * fichier du site.
 *
 * En ligne (site statique, pas de serveur) : les samples du site seulement
 * (la liste du build, virtual:rytm-samples) et comment voir le reste.
 * En dev, vite recharge la page quand des samples arrivent dans
 * public/samples/rytm : le serveur garde la publication en cours et son
 * resultat, la page rechargee les retrouve.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FOUND from 'virtual:rytm-samples';
import { sampleLabel } from '../../v4/audio/samplelabel';
import { adminRaw, isReadOnly } from '../lib/api';

/* ---------------- les voix, dans l'ordre des pads ---------------- */

const VOICES = [
  { fam: 'bd', code: 'BD', name: 'kick' },
  { fam: 'sd', code: 'SD', name: 'snare' },
  { fam: 'ch', code: 'CH', name: 'charley fermé' },
  { fam: 'oh', code: 'OH', name: 'charley ouvert' },
  { fam: 'cp', code: 'CP', name: 'clap' },
  { fam: 'tom', code: 'TOM', name: 'tom grave' },
  { fam: 'ht', code: 'HT', name: 'tom aigu et percus' },
  { fam: 'cy', code: 'CY', name: 'cymbale' },
] as const;
const CODE: Record<string, string> = Object.fromEntries(VOICES.map((v) => [v.fam, v.code]));

/* ---------------- ce que server.js rend ---------------- */

interface SiteSample {
  n: number;
  file: string;
  label: string;
  size: number;
  ignored: string | null;
  ours: boolean;
}

interface Candidate {
  id: string;
  rank: number;
  path: string;
  label: string;
  siteFile: string;
  folder: string;
  projects: number;
  refs: number;
  unused: boolean;
  bytes: number;
  kind: string | null;
  playable: boolean;
  alreadyOnSite: boolean;
  twin: string | null;
  icloud: boolean;
  default: boolean;
  autoMissing: boolean;
  aiff: boolean;
  reason: string | null;
  dupOf: string | null;
}

interface Family {
  title: string;
  target: number;
  need: number;
  present: number;
  files: number;
  used: number;
  site: SiteSample[];
  /** le numero du premier ajout (apres ceux deja sur le site) */
  start: number;
  candidates: Candidate[];
}

interface Scan {
  date: string;
  ms: number;
  shots: { path: string; found: boolean; files: number; placeholders: number; unknown: number; unknownTop: { path: string; projects: number }[]; unreadable: number };
  projects: { sets: number; parsed: number; failed: number; projects: number; refs: number; matched: number; unmatched: number; backups: number };
  icloud: { sets: number; samples: number };
  afconvert: boolean;
  options: { per: number; bdNew: number; maxPerVoice: number };
  families: Record<string, Family>;
}

interface ScanError {
  kind: string | null;
  message: string;
  shots: string | null;
  site: { families: Record<string, { site: SiteSample[] }> } | null;
}

interface Job {
  kind: 'scan' | 'publish';
  elapsed: number;
  progress: { phase?: string; done?: number; total?: number; fam?: string; files?: number };
}

interface PublishLine {
  fam: string;
  before: number;
  after: number;
  names: string[];
}

interface PublishResult {
  ok: boolean;
  at: string;
  lines?: PublishLine[];
  commit?: string | null;
  pushed?: boolean;
  pushError?: string[] | null;
  branch?: string;
  target?: string;
  onMain?: boolean;
  undo?: string;
  resetBackup?: string | null;
  refusal?: { code: number; kind: string | null; text: string };
  error?: string;
  log?: string[];
}

interface ServerState {
  state: 'idle' | 'running' | 'done' | 'error';
  job: Job | null;
  scan: Scan | null;
  error: ScanError | null;
  /** pendant une analyse : les samples du site, deja la */
  site: Record<string, { site: SiteSample[] }> | null;
  lastPublish: PublishResult | null;
}

/* ---------------- petits outils ---------------- */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const siteUrl = (fam: string, file: string) => `${import.meta.env.BASE_URL}samples/rytm/${fam}/${encodeURIComponent(file)}`;
const DISMISS_KEY = 'mm_admin_samples_seen';
/** Une date lisible (18 octobre, 22 h 49), en francais dans la page. */
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })} à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

function dismissed(at: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === at;
  } catch {
    return false;
  }
}

function dismiss(at: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, at);
  } catch {
    /* stockage refuse : la carte reviendra au prochain chargement */
  }
}

/** Les raisons du script (sans accents, pour le Terminal), dites pour la page. */
function reasonText(c: Candidate): string | null {
  const r = c.reason;
  if (!r || c.alreadyOnSite || c.icloud || c.dupOf) return null;
  if (/^vide/.test(r)) return 'fichier vide (0 octet)';
  if (/^pas un fichier audio/.test(r)) return "pas un vrai fichier audio (juste l'extension, ou coupé)";
  if (/^trop gros une fois/.test(r)) return `trop gros une fois en WAV ${r.replace(/^[^(]*/, '')}`;
  if (/^trop gros/.test(r)) return `trop gros ${r.replace(/^[^(]*/, '')}`;
  if (/^AIFF : Chrome/.test(r)) return "AIFF : afconvert (macOS) n'est pas là pour le convertir en WAV";
  if (/^AIFF, la conversion en WAV a echoue/.test(r)) return `AIFF : la conversion en WAV a échoué ${r.replace(/^[^(]*/, '')}`;
  if (/^AIFF, la conversion/.test(r)) return "AIFF : la conversion n'a pas donné de WAV";
  if (/^illisible/.test(r)) return `illisible ${r.replace(/^illisible\s*/, '')}`;
  return r;
}

function progressOf(job: Job | null): { text: string; ratio: number | null } {
  if (!job) return { text: '', ratio: null };
  const p = job.progress ?? {};
  if (job.kind === 'publish') {
    return { text: p.phase === 'import' ? 'Ajout des samples choisis, commit et push…' : 'Vérification du dépôt, git pull, puis nouvelle analyse…', ratio: null };
  }
  switch (p.phase) {
    case 'shots':
      return { text: 'Lecture du dossier shots…', ratio: null };
    case 'find':
      return { text: `Recherche de tes projets Ableton… (${plural(p.files ?? 0, 'sample')} dans shots)`, ratio: null };
    case 'sets':
      return { text: `Lecture de tes projets Ableton : ${p.done ?? 0} / ${p.total ?? 0}`, ratio: p.total ? (p.done ?? 0) / p.total : null };
    case 'plan':
      return { text: `Classement des samples : ${CODE[p.fam ?? ''] ?? ''}`, ratio: 1 };
    case 'candidates':
      return { text: 'Préparation des listes…', ratio: 1 };
    default:
      return { text: "Démarrage de l'analyse…", ratio: null };
  }
}

/* ---------------- l'ecoute : un son a la fois ---------------- */

function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stop = useCallback(() => {
    tokenRef.current += 1;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPlaying(null);
    setLoading(null);
  }, []);

  /** Joue key (la source rend une adresse ; blob : a liberer apres) ; le meme key une deuxieme fois : stop. */
  const toggle = useCallback(
    async (key: string, source: () => Promise<string>, blob: boolean) => {
      if (playing === key || loading === key) {
        stop();
        return;
      }
      stop();
      const token = tokenRef.current;
      setLoading(key);
      setErrors((e) => {
        if (!(key in e)) return e;
        const next = { ...e };
        delete next[key];
        return next;
      });
      try {
        const url = await source();
        if (token !== tokenRef.current) {
          if (blob) URL.revokeObjectURL(url);
          return;
        }
        if (blob) urlRef.current = url;
        let a = audioRef.current;
        if (!a) {
          a = new Audio();
          a.preload = 'auto';
          a.addEventListener('ended', () => setPlaying(null));
          audioRef.current = a;
        }
        a.src = url;
        await a.play();
        if (token === tokenRef.current) setPlaying(key);
      } catch (e) {
        if (token === tokenRef.current) {
          setErrors((cur) => ({ ...cur, [key]: String((e as Error).message || e) }));
          setPlaying(null);
        }
      } finally {
        if (token === tokenRef.current) setLoading(null);
      }
    },
    [playing, loading, stop]
  );

  useEffect(() => () => stop(), [stop]);
  return { playing, loading, errors, toggle, stop };
}
type Player = ReturnType<typeof usePlayer>;

const PlayIcon: React.FC<{ stop: boolean }> = ({ stop }) => (
  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
    {stop ? <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" /> : <path d="M3 1.6v6.8L8.6 5z" fill="currentColor" />}
  </svg>
);

const PlayButton: React.FC<{ id: string; player: Player; source: () => Promise<string>; blob: boolean; label: string; disabled?: boolean; disabledWhy?: string; small?: boolean }> = ({
  id,
  player,
  source,
  blob,
  label,
  disabled,
  disabledWhy,
  small,
}) => {
  const active = player.playing === id;
  const loading = player.loading === id;
  const title = disabled ? disabledWhy ?? 'Écoute impossible' : active ? `Arrêter ${label}` : `Écouter ${label}`;
  return (
    <button
      type="button"
      className={`admx-smp-play${active ? ' is-playing' : ''}${loading ? ' is-loading' : ''}${small ? ' is-small' : ''}`}
      aria-label={title}
      aria-pressed={active}
      title={title}
      disabled={disabled}
      data-play={id}
      onClick={() => player.toggle(id, source, blob)}
    >
      <PlayIcon stop={active} />
    </button>
  );
};

/** Un candidat a ecouter : server.js, avec le mot de passe, lu en blob. */
const previewSource = (id: string) => async (): Promise<string> => {
  const r = await adminRaw(`/api/admin/samples/preview?id=${encodeURIComponent(id)}`);
  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(j?.message || `Erreur serveur (${r.status})`);
  }
  return URL.createObjectURL(await r.blob());
};

/* ---------------- les samples du site d'une voix ---------------- */

const SiteList: React.FC<{ fam: string; list: SiteSample[]; player: Player }> = ({ fam, list, player }) => {
  if (list.length === 0) return <p className="admx-muted admx-smp-empty">Aucun sample du site : la voix joue son son de synthèse.</p>;
  return (
    <ul className="admx-smp-site">
      {list.map((s) => {
        const id = `s:${fam}/${s.file}`;
        return (
          <li key={s.file} className="admx-smp-chip" title={s.file} data-site={`${fam}/${s.file}`}>
            <PlayButton id={id} player={player} source={async () => siteUrl(fam, s.file)} blob={false} label={s.label} small />
            <span className="admx-smp-n">{s.n || ''}</span>
            <span className="admx-smp-chip-label">{s.label}</span>
            {s.ignored && <span className="admx-smp-badge warn" title={s.ignored}>pas en ligne</span>}
            {player.errors[id] && <span className="admx-smp-err">illisible ici</span>}
          </li>
        );
      })}
    </ul>
  );
};

/* ---------------- un candidat ---------------- */

interface RowProps {
  c: Candidate;
  checked: boolean;
  /** coche : son nom sur le site apres la publication (numero compris) */
  siteName: string;
  blockedWhy: string | null;
  twinRank: number | null;
  afconvert: boolean;
  player: Player;
  onToggle: () => void;
}

const CandidateRow: React.FC<RowProps> = ({ c, checked, siteName, blockedWhy, twinRank, afconvert, player, onToggle }) => {
  const id = `c:${c.id}`;
  const listenWhy = c.icloud
    ? "Pas encore téléchargé d'iCloud"
    : !c.kind
      ? reasonText(c) ?? 'Pas un fichier audio lisible'
      : c.kind === 'aiff' && !afconvert
        ? "AIFF : afconvert (macOS) n'est pas là pour le convertir"
        : null;
  const why = reasonText(c);
  const stats = c.unused ? 'jamais utilisé' : `${plural(c.projects, 'projet')} / ${plural(c.refs, 'utilisation')}`;
  return (
    <li className={`admx-smp-row${checked ? ' is-checked' : ''}${blockedWhy && !checked ? ' is-off' : ''}`} data-cand={c.id} data-default={c.default ? '1' : '0'}>
      <PlayButton id={id} player={player} source={previewSource(c.id)} blob label={c.label} disabled={Boolean(listenWhy)} disabledWhy={listenWhy ?? undefined} />
      <label className="admx-smp-pick" title={blockedWhy && !checked ? blockedWhy : undefined}>
        <input type="checkbox" checked={checked} disabled={Boolean(blockedWhy) && !checked} onChange={onToggle} aria-label={`Choisir ${c.label}`} />
        <span className="admx-smp-rank">{c.rank}</span>
        <span className="admx-smp-main">
          <span className="admx-smp-label">{c.label}</span>
          <span className="admx-smp-meta">
            {c.path} · <b>{stats}</b>
          </span>
          <span className="admx-smp-badges">
            {c.default && <span className="admx-smp-badge info">choix auto</span>}
            {c.alreadyOnSite && (
              <span className="admx-smp-badge ok" title={c.twin ? `Même son que ${c.twin}` : undefined}>
                déjà sur le site
              </span>
            )}
            {c.aiff && c.playable && <span className="admx-smp-badge info">AIFF → WAV</span>}
            {c.icloud && <span className="admx-smp-badge warn">pas téléchargé d'iCloud</span>}
            {!c.playable && !c.alreadyOnSite && !c.icloud && !c.dupOf && (
              <span className="admx-smp-badge danger" title={why ?? undefined}>
                illisible
              </span>
            )}
            {c.dupOf && <span className="admx-smp-badge warn">même son que le n° {twinRank ?? '?'}</span>}
            {checked && siteName && <span className="admx-smp-badge">sur le site : {siteName}</span>}
          </span>
          {why && <span className="admx-smp-why">{why}</span>}
          {player.errors[id] && <span className="admx-smp-err">{player.errors[id]}</span>}
        </span>
      </label>
    </li>
  );
};

/* ---------------- une voix ---------------- */

interface VoiceProps {
  voice: (typeof VOICES)[number];
  family: Family;
  checked: string[];
  maxPerVoice: number;
  afconvert: boolean;
  player: Player;
  onChange: (ids: string[]) => void;
}

const VoiceCard: React.FC<VoiceProps> = ({ voice, family, checked, maxPerVoice, afconvert, player, onChange }) => {
  const set = useMemo(() => new Set(checked), [checked]);
  const byId = useMemo(() => new Map(family.candidates.map((c) => [c.id, c])), [family.candidates]);
  const deepest = useMemo(() => Math.max(0, ...family.candidates.filter((c) => c.default || set.has(c.id)).map((c) => c.rank)), [family.candidates, set]);
  const [shown, setShown] = useState(() => Math.max(20, deepest + 5));
  const total = family.present + checked.length;
  const full = total >= maxPerVoice;
  const visible = family.candidates.slice(0, Math.max(shown, deepest));
  const hiddenCount = family.candidates.length - visible.length;
  const countClass = total === family.target ? ' is-full' : total > family.target ? ' is-over' : '';
  const defaults = family.candidates.filter((c) => c.default).map((c) => c.id);
  const sameAsDefault = defaults.length === checked.length && defaults.every((id) => set.has(id));

  // Le meme son sous plusieurs noms : un seul peut etre choisi (le groupe : le premier du classement)
  const chosenOfGroup = useMemo(() => {
    const m = new Map<string, string>();
    for (const id of checked) {
      const c = byId.get(id);
      if (c) m.set(c.dupOf ?? c.id, c.id);
    }
    return m;
  }, [checked, byId]);

  // Le nom sur le site d'un sample coche : la publication numerote les choisis a la suite du site, dans l'ordre
  // du classement (le serveur a calcule les noms pour le choix auto : un decoche ou un ajout decale les numeros).
  // Le nom apres le numero reste celui du serveur ; cas rare non couvert : deux choisis hors choix auto au meme
  // nom nettoye, la publication en allonge un (assignNames).
  const picked = useMemo(() => family.candidates.filter((c) => set.has(c.id)).sort((a, b) => a.rank - b.rank), [family.candidates, set]);
  const start = family.start ?? family.present + 1;
  const width = Math.max(2, String(start + picked.length - 1).length);
  const siteName = (c: Candidate): string => {
    const i = picked.indexOf(c);
    return i < 0 || !c.siteFile ? '' : `${String(start + i).padStart(width, '0')} ${c.siteFile.replace(/^\s*\d+\s+/, '')}`;
  };

  const blockedWhy = (c: Candidate): string | null => {
    if (c.icloud) return "Pas encore téléchargé d'iCloud : télécharge-le dans le Finder, puis Re-analyser";
    if (c.alreadyOnSite) return 'Déjà sur le site';
    if (!c.playable) return reasonText(c) ?? (c.dupOf ? "Même son qu'un autre sample" : 'Illisible');
    const twin = chosenOfGroup.get(c.dupOf ?? c.id);
    if (twin && twin !== c.id) return 'Le même son est déjà choisi';
    if (full) return `La voix est pleine (${maxPerVoice} au plus) : décoche un sample pour en choisir un autre`;
    return null;
  };

  return (
    <section className="admx-card admx-smp-voice" id={`voix-${voice.fam}`} data-voice={voice.fam}>
      <header className="admx-smp-vhead">
        <h2 className="admx-smp-vtitle">
          <b>{voice.code}</b> <span>{voice.name}</span>
        </h2>
        <span className={`admx-smp-count${countClass}`} title={`${family.present} sur le site + ${checked.length} choisi(s), cible ${family.target}`} data-count={voice.fam}>
          {total} / {family.target}
        </span>
      </header>
      <div className="admx-smp-vsub">
        {family.present} sur le site
        {checked.length > 0 ? ` + ${checked.length} à ajouter` : ''}
        {voice.fam === 'bd' && family.target > 20 ? ` (cible : 10 kicks de plus que ceux d'avant)` : ''}
      </div>

      <div className="admx-smp-sub">Sur le site</div>
      <SiteList fam={voice.fam} list={family.site} player={player} />

      <div className="admx-smp-sub admx-smp-sub-row">
        <span>
          Dans tes projets <span className="admx-smp-sub-n">({family.candidates.length})</span>
        </span>
        {family.candidates.length > 0 && (
          <span className="admx-smp-tools">
            <button type="button" className="admx-btn admx-btn-sm" disabled={sameAsDefault} onClick={() => onChange(defaults)}>
              Choix auto
            </button>
            <button type="button" className="admx-btn admx-btn-sm" disabled={checked.length === 0} onClick={() => onChange([])}>
              Aucun
            </button>
          </span>
        )}
      </div>
      {family.candidates.length === 0 ? (
        <p className="admx-muted admx-smp-empty">
          Rien dans shots pour cette voix. Range ses samples dans un dossier qui dit la voix (Kicks, Snares, Hats, Open Hats, Claps, Toms, Percs, Cymbals), puis Re-analyser.
        </p>
      ) : (
        <ol className="admx-smp-list">
          {visible.map((c) => (
            <CandidateRow
              key={c.id}
              c={c}
              checked={set.has(c.id)}
              siteName={siteName(c)}
              blockedWhy={blockedWhy(c)}
              twinRank={c.dupOf ? byId.get(c.dupOf)?.rank ?? null : null}
              afconvert={afconvert}
              player={player}
              onToggle={() => onChange(set.has(c.id) ? checked.filter((x) => x !== c.id) : [...checked, c.id])}
            />
          ))}
        </ol>
      )}
      {hiddenCount > 0 && (
        <button type="button" className="admx-btn admx-btn-sm admx-smp-more" onClick={() => setShown((n) => n + 30)}>
          Voir {Math.min(30, hiddenCount)} de plus ({hiddenCount} autres, du moins joué au jamais utilisé)
        </button>
      )}
    </section>
  );
};

/* ---------------- la fenetre de confirmation (fixe : style en ligne, cf. CLAUDE.md) ---------------- */

const Overlay: React.FC<{ children: React.ReactNode; onClose?: () => void; label: string }> = ({ children, onClose, label }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={label}
    style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(24,24,27,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}
  >
    <div className="admx-card admx-smp-modal">{children}</div>
  </div>
);

/* ---------------- le resultat d'une publication ---------------- */

const ResultCard: React.FC<{ result: PublishResult; onClose: () => void; onReset: () => void; onRescan: () => void; busy: boolean }> = ({ result, onClose, onReset, onRescan, busy }) => {
  const grown = (result.lines ?? []).filter((l) => l.after > l.before);
  const kind = result.refusal?.kind ?? null;
  const tone = result.ok ? 'is-ok' : result.commit ? 'is-warn' : 'is-danger';
  return (
    <div className={`admx-card admx-smp-result ${tone}`} data-result={result.ok ? 'ok' : result.refusal ? `refus:${kind ?? ''}` : 'echec'}>
      <div className="admx-smp-result-head">
        <h3>
          {result.ok
            ? 'Publié ✓'
            : result.commit
              ? 'Commit fait, mais pas encore en ligne'
              : result.refusal
                ? kind === 'nothing'
                  ? 'Rien à publier'
                  : 'Publication refusée'
                : 'La publication a échoué'}
        </h3>
        <button type="button" className="admx-btn admx-btn-sm" onClick={onClose}>
          Fermer
        </button>
      </div>

      {result.ok && (
        <>
          <p>
            Commit <code>{result.commit}</code> poussé sur <b>{result.target}</b>.{' '}
            {result.onMain
              ? 'Le site se met à jour tout seul dans 1 à 2 minutes (GitHub Actions), puis MM-RYTM, choix de son de chaque voix.'
              : `Attention : ta branche est ${result.branch}, pas main. Le site en ligne ne change qu'une fois cette branche fusionnée dans main.`}
          </p>
          <ul className="admx-smp-lines">
            {grown.map((l) => (
              <li key={l.fam}>
                <b>{CODE[l.fam]}</b> {l.before} → {l.after} <span className="admx-muted">(+{l.after - l.before})</span> : {l.names.join(', ')}
              </li>
            ))}
          </ul>
          <p className="admx-muted">Pour annuler (dans le Terminal, dans le dossier du site ; les nouveaux samples repartent, rien d'autre ne bouge) :</p>
          <pre className="admx-smp-pre">{result.undo}</pre>
        </>
      )}

      {!result.ok && result.commit && (
        <>
          <p>
            Le commit <code>{result.commit}</code> est fait sur ton Mac, mais <code>git push</code> a refusé : le site ne change pas encore.
          </p>
          {result.pushError && <pre className="admx-smp-pre">{result.pushError.join('\n')}</pre>}
        </>
      )}

      {result.refusal && (
        <>
          <p>{kind === 'nothing' ? "Aucun sample n'a été ajouté." : "Rien n'a été publié. Ce qui bloque, et quoi faire :"}</p>
          <pre className="admx-smp-pre">{result.refusal.text}</pre>
          {kind === 'dirty' && (
            <div className="admx-smp-result-actions">
              <button type="button" className="admx-btn primary" disabled={busy} onClick={onReset}>
                Remettre comme en ligne, puis publier ma sélection
              </button>
              <span className="admx-muted">
                Les fichiers modifiés ou en trop sont d'abord sauvegardés dans <code>.admin-backups/</code>, rien n'est perdu. Dans le Terminal, c'est{' '}
                <code>npm run samples:mika -- --reset-samples</code> (qui publie, lui, le choix automatique).
              </span>
            </div>
          )}
          {(kind === 'picks' || kind === 'missing') && (
            <div className="admx-smp-result-actions">
              <button type="button" className="admx-btn" disabled={busy} onClick={onRescan}>
                Re-analyser
              </button>
            </div>
          )}
        </>
      )}

      {result.error && <pre className="admx-smp-pre">{result.error}</pre>}
      {result.resetBackup && (
        <p className="admx-muted">
          Sauvegarde de ce qui était modifié ou en trop : <code>{result.resetBackup}</code>
        </p>
      )}
      {result.log && result.log.length > 0 && (
        <details className="admx-smp-log">
          <summary>Détails ({result.log.length} lignes)</summary>
          <pre className="admx-smp-pre">{result.log.join('\n')}</pre>
        </details>
      )}
    </div>
  );
};

/* ---------------- en ligne : les samples du site seulement ---------------- */

const ReadOnlySamples: React.FC = () => {
  const player = usePlayer();
  const byFam = useMemo(() => {
    const out: Record<string, SiteSample[]> = {};
    for (const v of VOICES) out[v.fam] = [];
    for (const x of FOUND) {
      if (!(x.family in out)) continue;
      out[x.family].push({ n: Number(/^\s*(\d+)/.exec(x.file)?.[1] ?? 0), file: x.file, label: sampleLabel(x.file), size: 0, ignored: null, ours: false });
    }
    for (const list of Object.values(out)) list.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: 'base' }));
    return out;
  }, []);
  const total = Object.values(byFam).reduce((n, l) => n + l.length, 0);
  return (
    <div className="admx-smp" data-mode="readonly">
      <div className="admx-head">
        <div>
          <h1 className="admx-title">Samples du MM-RYTM</h1>
          <div className="admx-sub">{plural(total, 'sample')} sur le site, voix par voix.</div>
        </div>
        <span className="admx-pill warn">consultation seule</span>
      </div>
      <div className="admx-card admx-smp-note" data-note="readonly">
        <p style={{ margin: 0 }}>
          Lance <code>npm run admin</code> sur ton Mac pour voir les samples de tes projets Ableton : les écouter, choisir ceux qui vont dans chaque voix et
          les publier.
        </p>
      </div>
      <div className="admx-smp-voices">
        {VOICES.map((v) => (
          <section key={v.fam} className="admx-card admx-smp-voice" data-voice={v.fam}>
            <header className="admx-smp-vhead">
              <h2 className="admx-smp-vtitle">
                <b>{v.code}</b> <span>{v.name}</span>
              </h2>
              <span className="admx-smp-count">{byFam[v.fam].length} sur le site</span>
            </header>
            <SiteList fam={v.fam} list={byFam[v.fam]} player={player} />
          </section>
        ))}
      </div>
    </div>
  );
};

/* ---------------- sur le Mac : l'analyse, le choix, la publication ---------------- */

const LocalSamples: React.FC = () => {
  const [st, setSt] = useState<ServerState | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [checked, setChecked] = useState<Record<string, string[]>>({});
  const applied = useRef<string | null>(null);
  const [confirm, setConfirm] = useState<null | { reset: boolean }>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const player = usePlayer();

  const load = useCallback(async (refresh = false) => {
    try {
      const r = await adminRaw(`/api/admin/samples/scan${refresh ? '?refresh=1' : ''}`);
      if (r.status === 404) {
        setFetchError('old-server');
        return;
      }
      if (!r.ok) throw new Error(`Erreur serveur (${r.status})`);
      setSt((await r.json()) as ServerState);
      setFetchError('');
    } catch (e) {
      setFetchError(String((e as Error).message || e));
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // Tant que le serveur travaille (analyse, publication), la page redemande
  useEffect(() => {
    if (st?.state !== 'running') return undefined;
    const t = window.setTimeout(() => load(false), 700);
    return () => window.clearTimeout(t);
  }, [st, load]);

  // Une nouvelle analyse : le choix automatique, coche d'avance
  const scan = st?.scan ?? null;
  useEffect(() => {
    if (!scan || applied.current === scan.date) return;
    applied.current = scan.date;
    const next: Record<string, string[]> = {};
    for (const v of VOICES) next[v.fam] = (scan.families[v.fam]?.candidates ?? []).filter((c) => c.default).map((c) => c.id);
    setChecked(next);
  }, [scan]);

  // La page rechargee par vite pendant ou juste apres une publication : son resultat
  const lastPublish = st?.lastPublish ?? null;
  useEffect(() => {
    if (!lastPublish || publishing || dismissed(lastPublish.at)) return;
    if (Date.now() - Date.parse(lastPublish.at) > 15 * 60 * 1000) return;
    setResult((cur) => cur ?? lastPublish);
  }, [lastPublish, publishing]);

  const running = st?.state === 'running';
  const job = st?.job ?? null;
  const publishRunning = publishing || job?.kind === 'publish';
  const total = VOICES.reduce((n, v) => n + (checked[v.fam]?.length ?? 0), 0);
  const prog = progressOf(job);

  const publish = async (reset: boolean) => {
    setConfirm(null);
    setPublishing(true);
    setResult(null);
    player.stop();
    try {
      const picks = Object.fromEntries(VOICES.map((v) => [v.fam, checked[v.fam] ?? []]).filter(([, ids]) => ids.length > 0));
      const r = await adminRaw('/api/admin/samples/publish', { method: 'POST', body: JSON.stringify(reset ? { picks, resetSamples: true } : { picks }) });
      const j = (await r.json().catch(() => null)) as { result?: PublishResult; message?: string } | null;
      setResult(j?.result ?? { ok: false, at: new Date().toISOString(), error: j?.message || `Erreur serveur (${r.status})` });
    } catch (e) {
      setResult({ ok: false, at: new Date().toISOString(), error: String((e as Error).message || e) });
    } finally {
      setPublishing(false);
      load(false);
    }
  };

  const closeResult = () => {
    if (result) dismiss(result.at);
    setResult(null);
  };

  if (fetchError === 'old-server') {
    return (
      <div className="admx-smp">
        <div className="admx-head">
          <h1 className="admx-title">Samples du MM-RYTM</h1>
        </div>
        <div className="admx-card is-warn">
          Le serveur local ne connaît pas encore cette page (il a démarré avant la mise à jour). Arrête <code>npm run admin</code> (Ctrl+C dans le Terminal) et
          relance-le.
        </div>
      </div>
    );
  }

  const families = scan?.families ?? null;
  const serverSite = st?.site ?? st?.error?.site?.families ?? null;

  return (
    <div className="admx-smp" data-mode="local" data-state={st?.state ?? 'loading'}>
      <div className="admx-head">
        <div>
          <h1 className="admx-title">Samples du MM-RYTM</h1>
          <div className="admx-sub">Les samples de tes projets Ableton, voix par voix : écoute, coche, publie. Le choix automatique est coché d'avance.</div>
        </div>
        <div className="admx-smp-actions">
          <button type="button" className="admx-btn" disabled={running || publishRunning} onClick={() => load(true)} data-action="scan">
            {running && job?.kind === 'scan' ? 'Analyse…' : scan || st?.error ? 'Re-analyser' : 'Analyser'}
          </button>
          <button type="button" className="admx-btn primary" disabled={total === 0 || running || publishRunning || !scan} onClick={() => setConfirm({ reset: false })} data-action="publish">
            Publier la sélection ({total})
          </button>
        </div>
      </div>

      {fetchError && <div className="admx-card is-danger">Le serveur local ne répond pas ({fetchError}). Lance <code>npm run admin</code>.</div>}

      {scan && (
        <div className="admx-kpis admx-smp-kpis">
          <div className="admx-kpi" data-kpi="shots">
            <b>{scan.shots.found ? 'Trouvé' : 'Introuvable'}</b>
            <span>Dossier shots</span>
            <small title={scan.shots.path}>{plural(scan.shots.files, 'sample')}{scan.shots.unknown > 0 ? `, ${scan.shots.unknown} sans voix` : ''}</small>
          </div>
          <div className="admx-kpi" data-kpi="projects">
            <b>{scan.projects.projects}</b>
            <span>Projets Ableton lus</span>
            <small>{plural(scan.projects.parsed, 'set')}, {plural(scan.projects.matched, 'utilisation')} de samples de shots</small>
          </div>
          <div className="admx-kpi" data-kpi="icloud">
            <b>{scan.icloud.sets}</b>
            <span>Projets pas téléchargés d'iCloud</span>
            <small>{scan.icloud.sets > 0 ? 'pas lus (les lire les téléchargerait)' : 'aucun : tous lus'}</small>
            {scan.icloud.samples > 0 && <small>et {plural(scan.icloud.samples, 'sample')} de shots pas téléchargé(s)</small>}
          </div>
          <div className="admx-kpi" data-kpi="selection">
            <b>{total}</b>
            <span>Samples choisis</span>
            <small>analyse du {when(scan.date)}</small>
          </div>
        </div>
      )}

      {(running || !st) && !publishRunning && (
        <div className="admx-card admx-smp-busy" data-busy="scan">
          <b>{st ? prog.text : 'Connexion au serveur local…'}</b>
          <div className="admx-muted">Tes projets sont lus sur ce Mac, rien n'est modifié. Ça peut prendre un moment s'il y en a beaucoup.</div>
          <div className={`admx-smp-progress${prog.ratio === null ? ' is-indeterminate' : ''}`}>
            <span style={prog.ratio === null ? undefined : { width: `${Math.round(prog.ratio * 100)}%` }} />
          </div>
        </div>
      )}

      {result && !publishRunning && (
        <ResultCard result={result} busy={running || publishRunning} onClose={closeResult} onReset={() => setConfirm({ reset: true })} onRescan={() => { closeResult(); load(true); }} />
      )}

      {!running && st?.error && (
        <div className="admx-card is-danger" data-error={st.error.kind ?? ''}>
          <h3 style={{ marginTop: 0 }}>{st.error.kind === 'shots' ? 'Dossier shots introuvable' : "L'analyse n'a pas pu se faire"}</h3>
          <pre className="admx-smp-pre">{st.error.message}</pre>
          {st.error.kind === 'shots' && (
            <p className="admx-muted" style={{ marginBottom: 0 }}>
              Le dossier attendu : <code>{st.error.shots}</code> (dans iCloud Drive : User Library, Samples, shots). Vérifie-le dans le Finder, puis Re-analyser.
            </p>
          )}
        </div>
      )}

      {scan && (scan.icloud.samples > 0 || scan.shots.unknown > 0 || scan.projects.failed > 0 || !scan.afconvert) && (
        <div className="admx-card admx-smp-notes">
          {scan.icloud.samples > 0 && (
            <p>
              <b>{plural(scan.icloud.samples, 'sample')} de shots pas téléchargé(s) d'iCloud</b> : on ne peut ni les écouter ni les publier. Dans le Finder, clic
              droit sur le dossier shots, « Télécharger maintenant », puis Re-analyser.
            </p>
          )}
          {scan.shots.unknown > 0 && (
            <p>
              <b>{plural(scan.shots.unknown, 'sample')} sans voix</b> (ni le dossier ni le nom ne disent kick, snare, hat…) :{' '}
              {scan.shots.unknownTop.slice(0, 5).map((u) => u.path).join(', ')}
              {scan.shots.unknown > 5 ? '…' : ''}. Range-les dans un dossier Kicks, Snares, Hats, Open Hats, Claps, Toms, Percs ou Cymbals, puis Re-analyser.
            </p>
          )}
          {scan.projects.failed > 0 && <p>{plural(scan.projects.failed, 'projet')} illisible(s), sautés.</p>}
          {!scan.afconvert && <p>afconvert (macOS) n'est pas là : les AIFF ne peuvent être ni écoutés ni publiés ici.</p>}
        </div>
      )}

      <div className="admx-smp-voices">
        {VOICES.map((v) => {
          const fam = families?.[v.fam];
          if (fam) {
            return (
              <VoiceCard
                key={`${v.fam}:${scan?.date}`}
                voice={v}
                family={fam}
                checked={checked[v.fam] ?? []}
                maxPerVoice={scan?.options.maxPerVoice ?? 40}
                afconvert={Boolean(scan?.afconvert)}
                player={player}
                onChange={(ids) => setChecked((cur) => ({ ...cur, [v.fam]: ids }))}
              />
            );
          }
          // Pas d'analyse (en cours, ou impossible) : les samples du site, du serveur ou sinon du build
          const site =
            serverSite?.[v.fam]?.site ??
            FOUND.filter((x) => x.family === v.fam)
              .map((x) => ({ n: Number(/^\s*(\d+)/.exec(x.file)?.[1] ?? 0), file: x.file, label: sampleLabel(x.file), size: 0, ignored: null, ours: false }))
              .sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: 'base' }));
          return (
            <section key={v.fam} className="admx-card admx-smp-voice" data-voice={v.fam}>
              <header className="admx-smp-vhead">
                <h2 className="admx-smp-vtitle">
                  <b>{v.code}</b> <span>{v.name}</span>
                </h2>
                <span className="admx-smp-count">{site.length} sur le site</span>
              </header>
              <SiteList fam={v.fam} list={site} player={player} />
            </section>
          );
        })}
      </div>

      {scan && (
        <div className="admx-smp-bar">
          <span>
            <b>{plural(total, 'sample')}</b> à ajouter
            {total > 0 ? ` (${VOICES.filter((v) => (checked[v.fam]?.length ?? 0) > 0).map((v) => `${v.code} +${checked[v.fam].length}`).join(', ')})` : ''}
          </span>
          <button type="button" className="admx-btn primary" disabled={total === 0 || running || publishRunning} onClick={() => setConfirm({ reset: false })}>
            Publier la sélection ({total})
          </button>
        </div>
      )}

      {confirm && scan && (
        <Overlay label="Confirmer la publication" onClose={() => setConfirm(null)}>
          <h3 className="admx-smp-modal-title">Publier {plural(total, 'sample')} sur le site ?</h3>
          <ul className="admx-smp-lines">
            {VOICES.filter((v) => (checked[v.fam]?.length ?? 0) > 0).map((v) => {
              const f = scan.families[v.fam];
              const n = checked[v.fam].length;
              return (
                <li key={v.fam}>
                  <b>{v.code}</b> {v.name} : +{n} ({f.present} → {f.present + n})
                </li>
              );
            })}
          </ul>
          <p>Ils s'ajoutent après les numéros déjà là : rien n'est retiré ni renuméroté. Puis commit et push : le site se met à jour en 1 à 2 minutes.</p>
          {confirm.reset && (
            <p className="admx-smp-warn">
              D'abord, <code>public/samples/rytm</code> est remis comme en ligne : les fichiers modifiés ou en trop sont sauvegardés dans{' '}
              <code>.admin-backups/</code>.
            </p>
          )}
          <div className="admx-smp-modal-actions">
            <button type="button" className="admx-btn" onClick={() => setConfirm(null)}>
              Annuler
            </button>
            <button type="button" className="admx-btn primary" onClick={() => publish(confirm.reset)} data-action="confirm">
              Publier
            </button>
          </div>
        </Overlay>
      )}

      {publishRunning && (
        <Overlay label="Publication en cours">
          <h3 className="admx-smp-modal-title">Publication en cours…</h3>
          <p>{job?.kind === 'publish' ? prog.text : 'Vérification du dépôt, ajout des samples, commit et push…'}</p>
          <div className="admx-smp-progress is-indeterminate">
            <span />
          </div>
          <p className="admx-muted" style={{ marginBottom: 0 }}>
            Ne ferme pas le Terminal de <code>npm run admin</code>. La page peut se recharger toute seule quand les samples arrivent : c'est normal.
          </p>
        </Overlay>
      )}
    </div>
  );
};

const SamplesPage: React.FC = () => (isReadOnly() ? <ReadOnlySamples /> : <LocalSamples />);

export default SamplesPage;
