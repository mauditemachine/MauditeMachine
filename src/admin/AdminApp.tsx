/**
 * Panneau admin local — shell : sidebar claire + routes imbriquees.
 * Monte sur /mm-admin/* (hors Layout). Chaque page d'edition est derriere
 * AdminGate (localhost sans mot de passe, LAN avec ADMIN_PASSWORD, en
 * ligne : ecran « edition locale uniquement »). Stats et Radar gardent
 * leurs routes pleines page existantes, la sidebar y mene.
 *
 * Etapes livrees : 2 (shell + tableau de bord). Discographie/Mixtapes (3),
 * Medias/Textes (4), Publier (5) : entrees presentes, pages a venir.
 */

import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import './admin.css';
import AdminGate from '../components/ui/AdminGate';
import DashboardPage from './pages/DashboardPage';

const AdminEvents = React.lazy(() => import('../components/AdminEvents'));

const EDIT_LINKS = [
  { to: '/mm-admin', label: 'Tableau de bord', end: true },
  { to: '/mm-admin/discographie', label: 'Discographie', soon: 'étape 3' },
  { to: '/mm-admin/mixtapes', label: 'Mixtapes', soon: 'étape 3' },
  { to: '/mm-admin/medias', label: 'Médias', soon: 'étape 4' },
  { to: '/mm-admin/textes', label: 'Textes', soon: 'étape 4' },
  { to: '/mm-admin/contenu', label: 'Événements & boutique' },
];

const TOOL_LINKS = [
  { to: '/mm-admin/stats', label: 'Stats' },
  { to: '/mm-admin/radar', label: 'Radar' },
];

const ComingSoon: React.FC<{ step: string }> = ({ step }) => (
  <div>
    <div className="admx-head">
      <h1 className="admx-title">Bientôt là</h1>
    </div>
    <div className="admx-coming">
      Cette section arrive à l'{step} de la construction du panneau.
    </div>
  </div>
);

const AdminApp: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.body.classList.add('admx-active');
    const prevTitle = document.title;
    document.title = 'Admin — Maudite Machine';
    return () => {
      document.body.classList.remove('admx-active');
      document.title = prevTitle;
    };
  }, []);

  // Le drawer mobile se referme a chaque navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="admx">
      <button
        type="button"
        className="admx-btn admx-menu-btn"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        ☰ Menu
      </button>
      {menuOpen && <div className="admx-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside className={`admx-side${menuOpen ? ' is-open' : ''}`}>
        <div className="admx-brand">
          Maudite Machine
          <small>Panneau d'administration</small>
        </div>

        {EDIT_LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `admx-side-link${isActive ? ' is-active' : ''}`}
          >
            {l.label}
            {l.soon && <span className="admx-soon">{l.soon}</span>}
          </NavLink>
        ))}

        <div className="admx-side-group">Outils</div>
        {TOOL_LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `admx-side-link${isActive ? ' is-active' : ''}`}
          >
            {l.label}
          </NavLink>
        ))}

        <div className="admx-side-group">Publication</div>
        <NavLink
          to="/mm-admin/publier"
          className={({ isActive }) => `admx-side-link${isActive ? ' is-active' : ''}`}
        >
          Publier
          <span className="admx-soon">étape 5</span>
        </NavLink>

        <div className="admx-side-foot">
          Modifications enregistrées sur cet ordinateur, publiées seulement
          via « Publier ».
        </div>
      </aside>

      <main className="admx-main">
        <Routes>
          <Route
            index
            element={
              <AdminGate>
                <DashboardPage />
              </AdminGate>
            }
          />
          <Route
            path="contenu"
            element={
              <AdminGate>
                <Suspense fallback={null}>
                  <AdminEvents />
                </Suspense>
              </AdminGate>
            }
          />
          <Route path="discographie" element={<AdminGate><ComingSoon step="étape 3" /></AdminGate>} />
          <Route path="mixtapes" element={<AdminGate><ComingSoon step="étape 3" /></AdminGate>} />
          <Route path="medias" element={<AdminGate><ComingSoon step="étape 4" /></AdminGate>} />
          <Route path="textes" element={<AdminGate><ComingSoon step="étape 4" /></AdminGate>} />
          <Route path="publier" element={<AdminGate><ComingSoon step="étape 5" /></AdminGate>} />
          <Route path="*" element={<Navigate to="/mm-admin" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminApp;
