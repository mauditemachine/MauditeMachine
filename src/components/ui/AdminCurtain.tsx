/**
 * AdminCurtain — rideau mot de passe cote client pour les outils admin
 * consultables en prod (/mm-admin/stats, /mm-admin/radar).
 *
 * C'est un RIDEAU, pas un coffre : site statique, le hash SHA-256 du mot de
 * passe (VITE_STATS_PASSWORD_HASH) est embarque dans le bundle. Les donnees
 * derriere restent non sensibles ; les vrais secrets (revenus Ditto) ne
 * quittent jamais le local. Localhost : pas de rideau, coherent avec
 * l'admin local sans mot de passe.
 */

import React, { useState } from 'react';

const HASH = (import.meta.env.VITE_STATS_PASSWORD_HASH || '').trim().toLowerCase();
const SESSION_KEY = 'mm_stats_ok';

const isLocalhost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const AdminCurtain: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(() => isLocalhost() || sessionStorage.getItem(SESSION_KEY) === HASH);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  if (open) return <>{children}</>;

  if (!HASH) {
    return (
      <div className="max-w-md mx-auto pt-[16vh] px-4 text-center">
        <p className="font-body text-white/70 leading-relaxed">
          Accès non configuré. Définis VITE_STATS_PASSWORD_HASH dans .env.production
          (voir .env.example pour générer le hash), rebuild, et cette page s'ouvrira
          avec ton mot de passe.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = await sha256Hex(value.trim());
    if (h === HASH) {
      sessionStorage.setItem(SESSION_KEY, HASH);
      setOpen(true);
    } else {
      setError(true);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xs mx-auto pt-[16vh] px-4">
      <label className="block font-body font-semibold text-white text-sm mb-2" htmlFor="curtain-pass">
        Mot de passe admin
      </label>
      <input
        id="curtain-pass"
        type="password"
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
        className="w-full font-body text-white bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 outline-none focus:border-white/40"
      />
      {error && <p className="font-body text-red-400 text-xs mt-2">Mot de passe incorrect.</p>}
      <button
        type="submit"
        className="mt-3 w-full font-body font-semibold bg-white text-black border-0 rounded-xl py-2.5 cursor-pointer"
      >
        Entrer
      </button>
    </form>
  );
};

export default AdminCurtain;
