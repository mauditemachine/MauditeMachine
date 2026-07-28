/**
 * AdminGate — ecran de login devant les panels d'administration.
 *
 * IMPORTANT : ce gate est une commodite d'interface, PAS la securite.
 * Le vrai verrou est cote serveur (authMiddleware dans api/server.js) :
 * toute route d'ecriture exige le secret et repond 401 sinon. Contourner
 * ce composant dans le navigateur ne donne acces a aucune ecriture.
 *
 * Le secret saisi n'est jamais dans le code ni dans le bundle : il vit en
 * memoire + sessionStorage (efface a la fermeture de l'onglet) et repart
 * en header Authorization sur chaque appel.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  restoreAdminSecret,
  setAdminSecret,
  clearAdminSecret,
  verifyAdminSecret,
  isApiConfigured,
  ADMIN_UNAUTHORIZED_EVENT,
} from '../../utils/adminApi';
import { useTranslation } from '../../lib/i18n';

interface AdminGateProps {
  children: React.ReactNode;
}

const AdminGate: React.FC<AdminGateProps> = ({ children }) => {
  const { t } = useTranslation();
  const a = t.adminAuth;

  const [unlocked, setUnlocked] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [booting, setBooting] = useState(true);

  // Revalide un secret deja present en sessionStorage (refresh de l'onglet)
  useEffect(() => {
    let cancelled = false;
    const existing = restoreAdminSecret();
    if (!existing) {
      setBooting(false);
      return;
    }
    verifyAdminSecret(existing).then(({ ok }) => {
      if (cancelled) return;
      if (ok) setUnlocked(true);
      else clearAdminSecret();
      setBooting(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Un 401 renvoye par n'importe quelle ecriture reverrouille le panel
  useEffect(() => {
    const onUnauthorized = () => {
      setUnlocked(false);
      setSecret('');
      setError(a.expired);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [a.expired]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!secret.trim() || checking) return;
      setChecking(true);
      setError('');

      const { ok, status } = await verifyAdminSecret(secret.trim());
      if (ok) {
        setAdminSecret(secret.trim());
        setSecret('');
        setUnlocked(true);
      } else if (status === 429) {
        setError(a.tooMany);
      } else if (status === 0) {
        // Distingue "URL absente au build" de "serveur injoignable" :
        // sans ca le message envoyait sur une fausse piste.
        setError(isApiConfigured() ? a.unreachable : a.notConfigured);
      } else {
        setError(a.wrong);
      }
      setChecking(false);
    },
    [secret, checking, a.tooMany, a.unreachable, a.notConfigured, a.wrong],
  );

  if (booting) {
    return <div className="admin-loading">{a.checking}</div>;
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="admin-page">
      <div className="admin-container" style={{ maxWidth: 420, paddingTop: '12vh' }}>
        <h1 className="admin-title">{a.title}</h1>

        <form className="admin-form-card" onSubmit={submit}>
          <label className="admin-label" htmlFor="admin-secret">
            {a.passwordLabel}
          </label>
          <input
            id="admin-secret"
            className="admin-input"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={a.placeholder}
            style={{ width: '100%', marginBottom: '1rem' }}
          />

          {error && (
            <div className="admin-status error" role="alert" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="admin-btn-primary"
            disabled={checking || !secret.trim()}
            style={{ width: '100%' }}
          >
            {checking ? a.checking : a.submit}
          </button>
        </form>

        <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.5 }}>{a.hint}</p>
      </div>
    </div>
  );
};

export default AdminGate;
