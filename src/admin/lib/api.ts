/**
 * Acces API du panneau admin : GET/PUT JSON vers server.js avec le secret
 * en Bearer, 401 notifie AdminGate (meme event que le reste de l'admin).
 */

import {
  getApiUrl,
  restoreAdminSecret,
  ADMIN_UNAUTHORIZED_EVENT,
} from '../../utils/adminApi';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = restoreAdminSecret();
  if (secret) h.Authorization = `Bearer ${secret}`;
  return h;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new Error('Serveur local indisponible');
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
