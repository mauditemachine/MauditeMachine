// API utilitaire pour l'administration
// En local: sauvegarde via server.js (localhost:3001)
// En production: sauvegarde via API Render → commit GitHub → auto-deploy
// Lecture publique: Sanity d'abord, fallback JSON si Sanity vide/erreur

import { fetchEvents, fetchMessages, fetchMerchItems, urlFor } from './sanityQueries';

const PROD_API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================
// SECRET ADMIN
// Le secret n'est PLUS un VITE_* (qui serait inline dans le bundle public).
// Il est saisi par l'utilisateur dans l'ecran de login, garde en memoire +
// sessionStorage (efface a la fermeture de l'onglet), et renvoye en header
// sur chaque appel d'ecriture. Le verrou reel est cote serveur.
// ============================================================

const SECRET_STORAGE_KEY = 'mm_admin_secret';
let adminSecret = '';

/** Restaure le secret depuis sessionStorage (survit a un refresh de l'onglet). */
export function restoreAdminSecret(): string {
  if (adminSecret) return adminSecret;
  try {
    adminSecret = sessionStorage.getItem(SECRET_STORAGE_KEY) || '';
  } catch {
    adminSecret = '';
  }
  return adminSecret;
}

export function setAdminSecret(secret: string): void {
  adminSecret = secret;
  try {
    sessionStorage.setItem(SECRET_STORAGE_KEY, secret);
  } catch {}
}

export function clearAdminSecret(): void {
  adminSecret = '';
  try {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
  } catch {}
}

/** Emis quand l'API renvoie 401 : le panel admin repasse a l'ecran de login. */
export const ADMIN_UNAUTHORIZED_EVENT = 'adminUnauthorized';

function notifyUnauthorized() {
  clearAdminSecret();
  window.dispatchEvent(new CustomEvent(ADMIN_UNAUTHORIZED_EVENT));
}

/**
 * Valide le secret aupres du serveur sans rien ecrire.
 * Retourne true si le secret est bon.
 */
export async function verifyAdminSecret(secret: string): Promise<{ ok: boolean; status: number }> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return { ok: false, status: 0 };
  try {
    const res = await fetch(`${apiUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

function sanityImageUrl(img: any): string {
  if (!img) return '';
  try { return urlFor(img).url(); } catch { return ''; }
}

let warnedMissingApiUrl = false;

/**
 * true quand l'admin tourne sur la machine de dev.
 * C'est la seule condition qui ouvre l'acces sans mot de passe : ailleurs,
 * rien ne change. Le verrou reel reste de toute facon cote serveur.
 */
export function isLocalAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/**
 * true quand le site est ouvert depuis le reseau local (iPad sur l'IP du
 * Mac, `npm run admin -- --lan`). L'API d'ecriture est alors le meme hote
 * port 3001, et le mot de passe reste exige (AdminGate + serveur).
 */
function isPrivateLanHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h) ||
    h.endsWith('.local')
  );
}

export function getApiUrl(): string {
  if (isLocalAdmin()) return 'http://localhost:3001';
  if (isPrivateLanHost()) return `http://${window.location.hostname}:3001`;

  // VITE_API_URL est volontairement absente en production : il n'existe
  // aucun serveur d'ecriture distant. L'admin en ligne le detecte via
  // isApiConfigured() et affiche un ecran explicite au lieu d'un login
  // qui echouerait en boucle. Simple info, ce n'est pas une erreur.
  if (!PROD_API_URL && !warnedMissingApiUrl) {
    warnedMissingApiUrl = true;
    console.info(
      '[admin] Edition en ligne desactivee (aucun serveur d\'ecriture distant). ' +
        'Utiliser l\'admin local : npm run dev + node server.js.',
    );
  }
  return PROD_API_URL;
}

/** true si l'API d'ecriture est joignable (URL configuree). */
export function isApiConfigured(): boolean {
  return !!getApiUrl();
}

/**
 * Headers d'ecriture : le secret saisi par l'admin part en Bearer.
 * Envoye aussi en local (le serveur de dev l'exige si ADMIN_PASSWORD est defini).
 */
function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = restoreAdminSecret();
  if (secret) headers['Authorization'] = `Bearer ${secret}`;
  return headers;
}

/**
 * Message d'echec commun aux sauvegardes. Avant, les fonctions save*
 * ignoraient le retour de callApi() et affichaient "Saved!" meme quand le
 * POST partait en 404 : l'onglet releases a fonctionne des semaines en
 * n'ecrivant QUE dans le brouillon localStorage, jamais sur le disque.
 */
const SAVE_FAILED_MESSAGE =
  'NOT saved to disk: write server unreachable or refused. ' +
  'Draft kept in this browser only. Is `npm run admin` running?';

async function callApi(endpoint: string, data: any): Promise<boolean> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return false;
  try {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 429) {
      // Secret invalide ou expire : on renvoie l'admin a l'ecran de login
      notifyUnauthorized();
      throw new Error(`Unauthorized (${res.status})`);
    }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return true;
  } catch (err) {
    console.warn(`API save failed (${endpoint}):`, err);
    return false;
  }
}

export interface Message {
  id: string;
  title: string;
  description: string;
  image: string;
  link?: {
    label: string;
    href: string;
  };
  date: string;
  main?: boolean; // News principale affichée 20s en premier
}

export interface Event {
  date: string;
  title: string;
  url: string;
  location: string;
  color: string;
  image: string;
}

// Sauvegarder les messages - localStorage TOUJOURS (persistance admin), + API si localhost
export const saveMessages = async (messages: Message[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(messages, null, 2);
    try {
      localStorage.setItem('admin_messages_backup', json);
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError') {
        localStorage.removeItem('admin_messages_backup');
        try { localStorage.setItem('admin_messages_backup', json); } catch (_) {
          return { success: false, message: 'Storage full - reduce image size' };
        }
      } else throw e;
    }
    const written = await callApi('/api/save-messages', messages);
    if (!written) return { success: false, message: SAVE_FAILED_MESSAGE };
    window.dispatchEvent(new CustomEvent('messagesUpdated', { detail: { key: 'messages', data: messages } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full, try smaller image') };
  }
};

// Système de synchronisation automatique
let syncInterval: NodeJS.Timeout | null = null;

// Désactiver la synchronisation automatique - sauvegarde manuelle seulement
export const startAutoSync = () => {
  console.log('⏹️ Synchronisation automatique désactivée - Sauvegarde manuelle seulement');
  // Ne fait rien - pas de synchronisation automatique
};

// Arrêter la synchronisation automatique
export const stopAutoSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏹️ Synchronisation automatique arrêtée');
  }
};

// Télécharger le JSON mis à jour pour remplacer le fichier en production
export const downloadUpdatedJSON = (data: any, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log(`📥 Téléchargement de ${filename} pour mise à jour en production`);
};

// Charger les messages - forAdmin: backup localStorage (admin); site public: Sanity → fallback JSON
export const loadMessages = async (forAdmin = false): Promise<Message[]> => {
  try {
    if (forAdmin) {
      const backup = localStorage.getItem('admin_messages_backup');
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed)) {
            return parsed.map((msg: any, index: number) => ({
              ...msg,
              id: msg.id || `msg-${Date.now()}-${index}`
            }));
          }
        } catch (_) {}
      }
    }
    try {
      const sanityData = await fetchMessages();
      if (sanityData && sanityData.length > 0) {
        return sanityData.map((m) => ({
          id: m._id,
          title: m.title,
          description: m.description || '',
          image: sanityImageUrl(m.image),
          date: m.date,
        }));
      }
    } catch (e) {
      console.warn('Sanity messages fetch failed, fallback JSON', e);
    }
    const response = await fetch(`/messages.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed');
    const messages = await response.json();
    return messages.map((msg: any, index: number) => ({
      ...msg,
      id: msg.id || `msg-${Date.now()}-${index}`
    }));
  } catch (error) {
    return [];
  }
};

export const saveEvents = async (events: Event[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(events, null, 2);
    try { localStorage.setItem('admin_events_backup', json); } catch (e: any) {
      if (e?.name === 'QuotaExceededError') { localStorage.removeItem('admin_events_backup'); localStorage.setItem('admin_events_backup', json); } else throw e;
    }
    const written = await callApi('/api/save-events', events);
    if (!written) return { success: false, message: SAVE_FAILED_MESSAGE };
    window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: { key: 'events', data: events } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full') };
  }
};

/**
 * Cle de rapprochement entre un event Sanity et une entree de events.json.
 * Insensible a la casse, aux espaces ET a la ponctuation : renommer
 * "GROOVE & BASS" en "GROOVE&BASS" d'un cote seulement cassait le
 * rapprochement, et l'image repartait alors en URL cdn.sanity.io.
 */
const eventKey = (date: string, title: string): string =>
  `${String(date || '').slice(0, 10)}|${String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}`;

/** Date seule, repli quand le titre a ete trop reecrit pour correspondre. */
const eventDay = (date: string): string => String(date || '').slice(0, 10);

/** true si l'image vient d'un CDN externe plutot que du depot. */
const isRemoteImage = (src: string): boolean => /^https?:\/\//i.test(src || '');

/** Charge public/events.json. null si illisible, pour distinguer "vide" de "echec". */
const fetchLocalEvents = async (): Promise<Event[] | null> => {
  try {
    const res = await fetch(`/events.json?t=${Date.now()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

/**
 * Charger les events. forAdmin : backup localStorage d'abord.
 *
 * Sanity fournit le texte (titre, date, lieu, lien, couleur) mais PAS les
 * images : le site sert ses visuels depuis le depot. Sans ca, un event
 * charge depuis Sanity repartait avec une URL cdn.sanity.io, et sauvegarder
 * un seul event reecrivait les 11 chemins de events.json en URL distantes,
 * rendant les fichiers de public/events/ inutiles.
 *
 * On rapproche donc chaque event Sanity de son entree locale (date + titre)
 * pour recuperer son chemin. S'il n'y en a pas (event tout neuf cree dans
 * Sanity), on garde l'URL Sanity le temps d'afficher quelque chose : le
 * serveur d'ecriture la rapatriera dans public/events/ a la sauvegarde.
 */
export const loadEvents = async (forAdmin = false): Promise<Event[]> => {
  if (forAdmin) {
    const backup = localStorage.getItem('admin_events_backup');
    if (backup) {
      try {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
  }

  const localEvents = await fetchLocalEvents();

  try {
    const sanityData = await fetchEvents(false);
    if (sanityData && sanityData.length > 0) {
      const parCle = new Map<string, string>();
      // Repli par date. Une date portee par deux events devient ambigue, on
      // la neutralise plutot que de risquer d'attribuer la mauvaise image.
      const parDate = new Map<string, string | null>();
      for (const ev of localEvents ?? []) {
        if (!ev.image || isRemoteImage(ev.image)) continue;
        parCle.set(eventKey(ev.date, ev.title), ev.image);
        const jour = eventDay(ev.date);
        parDate.set(jour, parDate.has(jour) ? null : ev.image);
      }
      return sanityData.map((ev) => ({
        date: ev.date,
        title: ev.title,
        url: ev.url || '',
        location: ev.location || '',
        color: ev.color || '',
        image:
          parCle.get(eventKey(ev.date, ev.title)) ||
          parDate.get(eventDay(ev.date)) ||
          sanityImageUrl(ev.image),
      }));
    }
  } catch (e) {
    console.warn('Sanity events fetch failed, fallback JSON', e);
  }

  if (localEvents) return localEvents;
  throw new Error('Failed to load events');
};

// Interface pour le merchandising
export interface MerchItem {
  id: number;
  src: string;
  alt: string;
  caption: string;
  price: string;
  category: string;
  active: boolean;
  soldOut: boolean;
  sizes?: {
    S: boolean;
    M: boolean;
    L: boolean;
    XL: boolean;
  };
}

export const saveMerchItems = async (merchItems: MerchItem[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(merchItems, null, 2);
    try { localStorage.setItem('admin_merch_backup', json); } catch (e: any) {
      if (e?.name === 'QuotaExceededError') { localStorage.removeItem('admin_merch_backup'); localStorage.setItem('admin_merch_backup', json); } else throw e;
    }
    const written = await callApi('/api/save-merch', merchItems);
    if (!written) return { success: false, message: SAVE_FAILED_MESSAGE };
    window.dispatchEvent(new CustomEvent('merchItemsUpdated', { detail: { key: 'merchItems', data: merchItems } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full') };
  }
};

// Charger le merchandising - forAdmin: backup; site public: Sanity → fallback JSON
export const loadMerchItems = async (forAdmin = false): Promise<MerchItem[]> => {
  try {
    if (forAdmin) {
      const backup = localStorage.getItem('admin_merch_backup');
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed)) {
            return parsed.map(item => ({
              ...item,
              sizes: item.sizes || { S: true, M: true, L: true, XL: true }
            }));
          }
        } catch (_) {}
      }
    }
    try {
      const sanityData = await fetchMerchItems(true);
      if (sanityData && sanityData.length > 0) {
        return sanityData.map((m, index) => ({
          id: index + 1,
          src: sanityImageUrl(m.image),
          alt: m.alt || m.caption,
          caption: m.caption,
          price: m.price || '',
          category: m.category || '',
          active: m.active !== false,
          soldOut: !!m.soldOut,
          sizes: {
            S: m.sizes?.S ?? true,
            M: m.sizes?.M ?? true,
            L: m.sizes?.L ?? true,
            XL: m.sizes?.XL ?? true,
          },
        }));
      }
    } catch (e) {
      console.warn('Sanity merch fetch failed, fallback JSON', e);
    }
    const response = await fetch(`/store.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed');
    let merchItems = await response.json();
    const cleanedItems = merchItems.map((item: MerchItem) => ({
      ...item,
      caption: item.caption?.replace(/\s*-\s*Front\s*$/i, '').trim() || item.caption,
      sizes: item.sizes || { S: true, M: true, L: true, XL: true }
    }));
    const hasChanges = cleanedItems.some((item: MerchItem, index: number) => item.caption !== merchItems[index].caption);
    if (hasChanges && isLocalAdmin()) {
      await saveMerchItems(cleanedItems);
      return cleanedItems;
    }
    return cleanedItems;
  } catch (error) {
    console.error('Erreur lors du chargement du merchandising:', error);
    throw error;
  }
};

// ============================================================
// RELEASES / RADAR — veille musicale (labels & artistes suivis)
// Meme flux que events/merch/news : ecriture via API -> commit
// GitHub -> auto-deploy ; lecture depuis public/releases.json.
// ============================================================

export type ReleaseSection = 'feature' | 'labels' | 'artistes';
export type ReleaseFormat = 'Single' | 'EP' | 'Album' | 'Compilation' | 'VA';

export interface Release {
  id: number;
  artist: string;
  title: string;
  label: string;
  /** ISO YYYY-MM-DD */
  releaseDate: string;
  genre: string;
  format: ReleaseFormat;
  /** URL Beatport / Bandcamp / SoundCloud */
  link: string;
  /**
   * URL SoundCloud optionnelle (track ou set). Si presente, le lecteur du
   * Radar joue la VERSION COMPLETE via le widget SoundCloud au lieu de
   * l'extrait iTunes de 30 s.
   */
  soundcloudUrl?: string;
  /** Chemin image optionnel ; si vide -> degrade colorFrom/colorTo + initiales */
  cover?: string;
  section: ReleaseSection;
  favorite: boolean;
  colorFrom: string;
  colorTo: string;
  /** Permet de masquer une sortie sans la supprimer */
  publishedRadar: boolean;
}

export const RELEASE_FORMATS: ReleaseFormat[] = ['Single', 'EP', 'Album', 'Compilation', 'VA'];
export const RELEASE_SECTIONS: ReleaseSection[] = ['feature', 'labels', 'artistes'];

// ============================================================
// IMPORT EN LOT (onglet releases)
// Le JSON de la veille hebdo se colle tel quel dans l'admin. Fonction pure :
// aucune ecriture ici, l'appelant fait UNE seule sauvegarde avec `merged`.
// ============================================================

export type ReleasesImportResult =
  | { ok: true; merged: Release[]; added: number; duplicates: number; invalid: number }
  | { ok: false; reason: 'invalid-json' | 'not-array' };

/**
 * Cle de deduplication : artist + title + label + releaseDate, insensible
 * a la casse et aux espaces. "Damon Jee - Club Scenes" et "damon jee -
 * club  scenes" sont la meme sortie.
 */
const releaseDedupKey = (r: {
  artist?: unknown;
  title?: unknown;
  label?: unknown;
  releaseDate?: unknown;
}): string =>
  [r.artist, r.title, r.label, r.releaseDate]
    .map((v) => String(v ?? '').toLowerCase().replace(/\s+/g, ''))
    .join('|');

/**
 * Parse et prepare un lot colle dans l'admin.
 * - JSON invalide ou pas un tableau : erreur, rien a sauvegarder.
 * - Entree sans artist ou sans title : comptee invalide, ignoree.
 * - Champs manquants : format EP, section labels, favorite false,
 *   publishedRadar true, degrade par defaut.
 * - Doublons (contre l'existant ET a l'interieur du lot) : comptes, pas
 *   ajoutes. Re-importer le meme JSON doit donner 0 ajout.
 */
export function prepareReleasesImport(raw: string, existing: Release[]): ReleasesImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  // Tolere un objet release seul, colle sans ses crochets.
  const batch = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? [parsed]
      : null;
  if (!batch) return { ok: false, reason: 'not-array' };

  const seen = new Set(existing.map(releaseDedupKey));
  let nextId = existing.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const merged = [...existing];
  let added = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const entry of batch) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      invalid++;
      continue;
    }
    const e = entry as Record<string, unknown>;
    const artist = str(e.artist);
    const title = str(e.title);
    if (!artist || !title) {
      invalid++;
      continue;
    }

    const release: Release = {
      id: nextId,
      artist,
      title,
      label: str(e.label),
      releaseDate: str(e.releaseDate),
      genre: str(e.genre),
      format: (RELEASE_FORMATS as string[]).includes(str(e.format))
        ? (str(e.format) as ReleaseFormat)
        : 'EP',
      link: str(e.link),
      soundcloudUrl: str(e.soundcloudUrl),
      cover: str(e.cover),
      section: (RELEASE_SECTIONS as string[]).includes(str(e.section))
        ? (str(e.section) as ReleaseSection)
        : 'labels',
      favorite: e.favorite === true,
      colorFrom: str(e.colorFrom) || '#ff2e4d',
      colorTo: str(e.colorTo) || '#3a0d18',
      publishedRadar: e.publishedRadar !== false,
    };

    const key = releaseDedupKey(release);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    merged.push(release);
    nextId++;
    added++;
  }

  return { ok: true, merged, added, duplicates, invalid };
}

export const saveReleases = async (releases: Release[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(releases, null, 2);
    try {
      localStorage.setItem('admin_releases_backup', json);
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError') {
        localStorage.removeItem('admin_releases_backup');
        localStorage.setItem('admin_releases_backup', json);
      } else throw e;
    }
    const written = await callApi('/api/save-releases', releases);
    if (!written) return { success: false, message: SAVE_FAILED_MESSAGE };
    window.dispatchEvent(new CustomEvent('releasesUpdated', { detail: { key: 'releases', data: releases } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full') };
  }
};

/**
 * Charge les sorties. forAdmin=true lit d'abord le backup localStorage
 * (edition en cours non encore deployee), comme loadEvents.
 */
export const loadReleases = async (forAdmin = false): Promise<Release[]> => {
  if (forAdmin) {
    try {
      const backup = localStorage.getItem('admin_releases_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
  }
  const response = await fetch(`/releases.json?t=${Date.now()}`);
  if (!response.ok) throw new Error('Failed to load releases');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};
