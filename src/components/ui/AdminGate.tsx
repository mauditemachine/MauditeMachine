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
 *
 * EN LOCAL (localhost / 127.0.0.1) : pas d'ecran de mot de passe. Le gate
 * demande au serveur de dev s'il exige un secret ; s'il n'en exige pas, on
 * entre directement. Ca ne retire aucune protection, ca ne fait qu'arreter
 * de reclamer un mot de passe la ou le serveur n'en demande deja pas.
 * Rien ne change hors localhost.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  restoreAdminSecret,
  setAdminSecret,
  clearAdminSecret,
  verifyAdminSecret,
  isApiConfigured,
  isLocalAdmin,
  ADMIN_UNAUTHORIZED_EVENT,
} from '../../utils/adminApi';
import { useTranslation } from '../../lib/i18n';
import AdminNav from './AdminNav';

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
  const [localDown, setLocalDown] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // En local, on entre sans rien saisir. Le serveur de dev laisse passer
      // l'ecriture tant qu'ADMIN_PASSWORD n'est pas defini : on le lui demande
      // plutot que de le supposer, donc quelqu'un qui definit ce mot de passe
      // sur sa machine retrouve le login normalement.
      if (isLocalAdmin()) {
        const { ok, status } = await verifyAdminSecret('');
        if (cancelled) return;
        if (ok) {
          setUnlocked(true);
          setBooting(false);
          return;
        }
        // status 0 = rien n'ecoute sur le port 3001. Afficher un champ mot de
        // passe serait trompeur : le probleme est que le serveur n'est pas la.
        if (status === 0) {
          setLocalDown(true);
          setBooting(false);
          return;
        }
      }

      // Sinon : revalide un secret deja present en sessionStorage (refresh d'onglet)
      const existing = restoreAdminSecret();
      if (!existing) {
        setBooting(false);
        return;
      }
      const { ok } = await verifyAdminSecret(existing);
      if (cancelled) return;
      if (ok) setUnlocked(true);
      else clearAdminSecret();
      setBooting(false);
    })();

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

  // En local, serveur d'ecriture eteint : on dit quoi lancer.
  if (localDown) {
    return (
      <div className="admin-page">
        <div className="admin-container" style={{ maxWidth: 480, paddingTop: '12vh' }}>
          <h1 className="admin-title">{a.localDownTitle}</h1>
          <div className="admin-form-card">
            <p style={{ color: '#ccc', lineHeight: 1.6, margin: 0 }}>{a.localDownBody}</p>
          </div>
          <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.5 }}>
            <code>npm run admin</code>
          </p>
        </div>
      </div>
    );
  }

  // Aucun serveur d'ecriture joignable (VITE_API_URL absente en production).
  // On affiche un ecran explicite AVANT le formulaire : proposer un champ
  // mot de passe qui ne peut pas aboutir ne ferait que boucler sur une erreur.
  if (!isApiConfigured()) {
    return (
      <div className="admin-page">
        <div className="admin-container" style={{ maxWidth: 480, paddingTop: '12vh' }}>
          <h1 className="admin-title">{a.offlineTitle}</h1>
          {/* Radar et Stats restent consultables en prod : ne pas laisser
              cet ecran en cul-de-sac */}
          <AdminNav />
          <div className="admin-form-card">
            <p style={{ color: '#ccc', lineHeight: 1.6, margin: 0 }}>{a.offlineBody}</p>
          </div>
          <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.5 }}>
            <code>npm run admin</code> puis <code>localhost:5173/mm-admin</code>
          </p>
        </div>
      </div>
    );
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
