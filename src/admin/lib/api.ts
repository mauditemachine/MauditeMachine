/**
 * Acces API du panneau admin.
 *
 * En LOCAL (npm run admin) : requetes vers server.js, lecture ET
 * ecriture. EN LIGNE : le site est statique, aucun serveur d'ecriture
 * n'existe — les pages de lecture basculent sur staticData.ts (audit du
 * site reellement deploye), l'ecriture est refusee avec un message clair.
 */

import {
  getApiUrl,
  restoreAdminSecret,
  ADMIN_UNAUTHORIZED_EVENT,
} from '../../utils/adminApi';
import { staticSeo, staticSummary } from './staticData';

/** true quand aucun serveur d'ecriture n'est joignable (site en ligne). */
export const isReadOnly = () => !getApiUrl();

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = restoreAdminSecret();
  if (secret) h.Authorization = `Bearer ${secret}`;
  return h;
}

/** Equivalents navigateur des routes de lecture, pour le mode en ligne. */
const STATIC_ROUTES: Record<string, () => Promise<unknown>> = {
  '/api/admin/summary': staticSummary,
  '/api/admin/seo': staticSeo,
  // Etat git : necessite le depot local, silencieux en ligne
  '/api/admin/git/status': async () => ({
    success: true,
    readOnly: true,
    branch: null,
    changedFiles: [],
    lastCommit: null,
    deploy: null,
  }),
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiUrl();

  if (!base) {
    const isWrite = !!init && init.method && init.method !== 'GET';
    const fallback = !isWrite && STATIC_ROUTES[path];
    if (fallback) return (await fallback()) as T;
    throw new Error(
      "Modification impossible en ligne : lance « npm run admin » sur ton ordinateur pour éditer."
    );
  }

  const res = await fetch(`${base}${path}`, { headers: headers(), ...init });
  if (res.status === 401 || res.status === 429) {
    window.dispatchEvent(new CustomEvent(ADMIN_UNAUTHORIZED_EVENT));
    throw new Error('Accès refusé');
  }
  if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  return res.json() as Promise<T>;
}

export const adminGet = <T>(path: string) => request<T>(path);

export const adminPut = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });

export const adminPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
