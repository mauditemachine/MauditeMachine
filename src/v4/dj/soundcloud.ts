/**
 * SoundCloud pour le MM-DECKS (2026-10-04, Mika : "ce qu'il y a sur Audius
 * c'est vraiment pourri", puis "oui branche soundcloud"). Le site est
 * statique : la cle de l'application SoundCloud vit dans le Worker de Sonaa
 * (sonaa-sets, worker/src/soundcloud.ts), qui cherche les morceaux et ouvre
 * leurs flux ; la page ne la voit jamais.
 *
 * Seulement les licences Creative Commons qui autorisent le remix (et le
 * domaine public) : les conditions de l'API interdisent de modifier un
 * morceau sans la permission de son auteur, et une platine le modifie
 * (vitesse, EQ, filtre, effets). L'auteur, SoundCloud et la page du morceau
 * sont credites dans la playlist et sur l'ecran de la platine. Le son n'est
 * garde nulle part : il est decode en memoire, le temps de la visite.
 *
 * Le son arrive en morceaux de fichier MP3 (HLS) que la page met bout a
 * bout : directement depuis le CDN de SoundCloud, ou par le relais du
 * Worker si le CDN refuse le navigateur.
 *
 * MY SOUNDCLOUD (Mika, 2026-10-04 : "je veux que les gens puissent
 * connecter leur soundcloud") : on se connecte avec son compte SoundCloud,
 * pas avec un compte du site, et on mixe ses propres morceaux. La connexion
 * se fait dans une fenetre a part (les platines gardent leurs morceaux) ;
 * elle finit sur public/soundcloud-connect.html, qui range le numero de
 * seance dans localStorage et se ferme : l'evenement storage previent la
 * page. Les jetons SoundCloud restent dans le Worker ; la page n'a que ce
 * numero, qu'elle envoie en Authorization, jamais dans une adresse.
 */

import type { DjTrack } from './state';
import { camelot } from './math';

const PASSERELLE = 'https://sonaa-sets.massivemedias.workers.dev/api/soundcloud';

/** Le nom court d'une licence, pour l'ecran. */
export const LICENSE_LABEL: Readonly<Record<string, string>> = {
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'no-rights-reserved': 'CC0',
  /** les morceaux de Maudite Machine : pas de licence a afficher, c'est la maison */
  mauditemachine: '',
  /** les morceaux du compte connecte : les siens */
  mine: '',
};

interface Raw {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  duration: number;
  license: string;
  link: string;
}

/** off : pas de cle dans le Worker ; down : il ne repond pas ; out : pas (ou plus) connecte. */
export type ScSearch = { ok: true; tracks: DjTrack[] } | { ok: false; reason: 'off' | 'down' | 'out' };

/* --- Le compte SoundCloud connecte ----------------------------------------- */

const ACCOUNT_KEY = 'mm.v4.dj.sc';
/** La page de retour ecrit ici quand SoundCloud refuse (ou qu'on annule). */
const FAIL_KEY = 'mm.v4.dj.sc.fail';

export interface ScAccount {
  /** le numero de seance du Worker */
  s: string;
  name: string;
}

export interface ScAccountState {
  account: ScAccount | null;
  /** la fenetre de SoundCloud est ouverte */
  pending: boolean;
  /** la derniere tentative a echoue */
  failed: boolean;
}

const readAccount = (): ScAccount | null => {
  try {
    const v = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) ?? 'null') as { s?: unknown; name?: unknown } | null;
    return v && typeof v.s === 'string' ? { s: v.s, name: typeof v.name === 'string' ? v.name : '' } : null;
  } catch {
    return null;
  }
};

let acct: ScAccountState = { account: null, pending: false, failed: false };
let started = false;
let waitTimer = 0;
const acctListeners = new Set<() => void>();
const setAcct = (next: Partial<ScAccountState>): void => {
  acct = { ...acct, ...next };
  acctListeners.forEach((fn) => fn());
};

/** La fenetre de SoundCloud a fini : la page de retour a ecrit dans localStorage. */
const onStorage = (e: StorageEvent): void => {
  if (e.key === ACCOUNT_KEY) {
    window.clearTimeout(waitTimer);
    setAcct({ account: readAccount(), pending: false, failed: false });
  } else if (e.key === FAIL_KEY && e.newValue) {
    window.clearTimeout(waitTimer);
    setAcct({ pending: false, failed: true });
  }
};

export const scAccount = {
  get: (): ScAccountState => {
    if (!started) {
      started = true;
      acct = { ...acct, account: readAccount() };
      window.addEventListener('storage', onStorage);
    }
    return acct;
  },
  subscribe(fn: () => void): () => void {
    acctListeners.add(fn);
    return () => {
      acctListeners.delete(fn);
    };
  },
};

const forgetLocal = (): void => {
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* rien a oublier */
  }
  setAcct({ account: null });
};

const authHeaders = (): HeadersInit | undefined => {
  const a = scAccount.get().account;
  return a ? { Authorization: `Bearer ${a.s}` } : undefined;
};

/** La page ou revenir apres une connexion en pleine page (lue par public/soundcloud-connect.html). */
const BACK_KEY = 'mm.v4.dj.sc.back';

/** Ouverte depuis l'ecran d'accueil (iPhone) : une fenetre a part n'y partagerait pas le stockage. */
const standalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Ouvre la page de connexion de SoundCloud dans une fenetre. Installee sur
 * l'ecran d'accueil, ou fenetre bloquee (rare : c'est un clic), la page
 * entiere y va et revient ici (BACK_KEY).
 */
export function connectSoundcloud(): void {
  const url = `${PASSERELLE}/connexion?origine=${encodeURIComponent(window.location.origin)}`;
  const full = (): void => {
    try {
      window.sessionStorage.setItem(BACK_KEY, window.location.pathname + window.location.search + window.location.hash);
    } catch {
      /* la page de retour proposera un lien */
    }
    window.location.assign(url);
  };
  if (standalone()) {
    full();
    return;
  }
  const w = window.open(url, 'mm-soundcloud', 'popup,width=520,height=760');
  if (!w) {
    full();
    return;
  }
  window.clearTimeout(waitTimer);
  // Sans nouvelles apres trois minutes (fenetre fermee a la main) : le bouton revient
  waitTimer = window.setTimeout(() => setAcct({ pending: false }), 180_000);
  setAcct({ pending: true, failed: false });
}

/** Se deconnecter : la seance s'efface au Worker et ici. */
export function disconnectSoundcloud(): void {
  const h = authHeaders();
  if (h) void fetch(`${PASSERELLE}/deconnexion`, { method: 'POST', headers: h, keepalive: true }).catch(() => undefined);
  forgetLocal();
}

/** Les morceaux publics du compte connecte. */
export async function myTracks(signal: AbortSignal): Promise<ScSearch> {
  const h = authHeaders();
  if (!h) return { ok: false, reason: 'out' };
  let r: Response;
  try {
    r = await fetch(`${PASSERELLE}/moi`, { headers: h, signal });
  } catch {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    return { ok: false, reason: 'down' };
  }
  if (r.status === 401) {
    // Seance perimee (soixante jours sans servir, ou acces retire chez SoundCloud)
    forgetLocal();
    return { ok: false, reason: 'out' };
  }
  if (r.status === 503) return { ok: false, reason: 'off' };
  if (!r.ok) return { ok: false, reason: 'down' };
  const d = (await r.json()) as { name?: string; tracks?: Raw[] };
  const a = scAccount.get().account;
  if (a && d.name && d.name !== a.name) {
    try {
      window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ s: a.s, name: d.name }));
    } catch {
      /* le nom suivra a la prochaine visite */
    }
    setAcct({ account: { s: a.s, name: d.name } });
  }
  return { ok: true, tracks: (d.tracks ?? []).map(toTrack) };
}

const toTrack = (t: Raw): DjTrack => ({
  id: t.id,
  source: 'soundcloud' as const,
  title: t.title,
  artist: t.artist,
  bpm: t.bpm,
  key: camelot(t.key),
  duration: t.duration,
  link: t.link,
  license: t.license,
});

/**
 * Les morceaux de Maudite Machine (Mika, 2026-10-04 : "les gens pourront
 * mixer mes tracks") : son compte SoundCloud, quelle que soit la licence,
 * puisque l'auteur y consent ; une heure de cache au Worker.
 */
export async function mauditeTracks(signal: AbortSignal): Promise<ScSearch> {
  let r: Response;
  try {
    r = await fetch(`${PASSERELLE}/maudite`, { signal });
  } catch {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    return { ok: false, reason: 'down' };
  }
  if (r.status === 503) return { ok: false, reason: 'off' };
  if (!r.ok) return { ok: false, reason: 'down' };
  const d = (await r.json()) as { tracks?: Raw[] };
  return { ok: true, tracks: (d.tracks ?? []).map(toTrack) };
}

/** Cherche (vide : des styles de club) ; 'off' tant que la cle n'est pas posee dans le Worker. */
export async function searchSoundcloud(q: string, signal: AbortSignal): Promise<ScSearch> {
  let r: Response;
  try {
    r = await fetch(`${PASSERELLE}/chercher?q=${encodeURIComponent(q)}`, { signal });
  } catch {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    return { ok: false, reason: 'down' };
  }
  if (r.status === 503) return { ok: false, reason: 'off' };
  if (!r.ok) return { ok: false, reason: 'down' };
  const d = (await r.json()) as { tracks?: Raw[] };
  return { ok: true, tracks: (d.tracks ?? []).map(toTrack) };
}

/** Les octets d'un morceau : ses morceaux de fichier, quatre a la fois, mis bout a bout. */
export async function soundcloudBytes(urn: string, progress: (p: number) => void, signal: AbortSignal): Promise<ArrayBuffer> {
  // Connecte : le Worker passe par son jeton (ses propres morceaux sont permis)
  const r = await fetch(`${PASSERELLE}/flux?urn=${encodeURIComponent(urn)}`, { signal, headers: authHeaders() });
  if (r.status === 503) throw new Error('SoundCloud is not connected');
  if (!r.ok) throw new Error(`SoundCloud ${r.status}`);
  const { pieces } = (await r.json()) as { format: 'mp3' | 'aac'; pieces: string[] };
  const parts: Uint8Array[] = new Array(pieces.length);
  let relay = false;
  let done = 0;
  const one = async (i: number): Promise<void> => {
    const direct = (): Promise<Response> => fetch(pieces[i], { signal });
    const relayed = (): Promise<Response> => fetch(`${PASSERELLE}/piece?u=${encodeURIComponent(pieces[i])}`, { signal });
    let res: Response;
    if (relay) res = await relayed();
    else {
      try {
        res = await direct();
      } catch (e) {
        if (signal.aborted) throw e;
        // Le CDN refuse la page (CORS) : tout passe desormais par le relais
        relay = true;
        res = await relayed();
      }
    }
    if (!res.ok) throw new Error(`SoundCloud piece ${res.status}`);
    parts[i] = new Uint8Array(await res.arrayBuffer());
    done += 1;
    progress(done / pieces.length);
  };
  // Le premier seul (il decide du relais), puis quatre a la fois
  await one(0);
  let next = 1;
  const worker = async (): Promise<void> => {
    while (next < pieces.length) {
      const i = next;
      next += 1;
      await one(i);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out.buffer;
}
