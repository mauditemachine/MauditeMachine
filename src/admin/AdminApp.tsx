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
import AdminCurtain from '../components/ui/AdminCurtain';
import { isReadOnly } from './lib/api';
import DashboardPage from './pages/DashboardPage';
const DiscographyPage = React.lazy(() => import('./pages/DiscographyPage'));
const MixtapesPage = React.lazy(() => import('./pages/MixtapesPage'));
const SeoPage = React.lazy(() => import('./pages/SeoPage'));

const AdminEvents = React.lazy(() => import('../components/AdminEvents'));

const EDIT_LINKS = [
  { to: '/mm-admin', label: 'Tableau de bord', end: true },
  { to: '/mm-admin/contenu', label: 'Événements & boutique' },
  { to: '/mm-admin/discographie', label: 'Discographie' },
  { to: '/mm-admin/mixtapes', label: 'Mixtapes' },
  { to: '/mm-admin/medias', label: 'Médias', soon: 'bientôt' },
  { to: '/mm-admin/textes', label: 'Textes', soon: 'bientôt' },
];

const TOOL_LINKS = [
  { to: '/mm-admin/seo', label: 'Visibilité Google' },
  { to: '/mm-admin/stats', label: 'Stats' },
  { to: '/mm-admin/radar', label: 'Radar' },
];

/**
 * En ligne le site est statique : pas de serveur d'ecriture. Les pages de
 * lecture passent par le rideau mot de passe, les pages d'edition
 * expliquent qu'il faut l'admin local.
 */
const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  isReadOnly() ? <AdminCurtain>{children}</AdminCurtain> : <AdminGate>{children}</AdminGate>;

const LocalOnly: React.FC<{ what: string }> = ({ what }) => (
  <div>
    <div className="admx-head">
      <h1 className="admx-title">{what}</h1>
      <span className="admx-pill warn">consultation seule</span>
    </div>
    <div className="admx-card">
      <p style={{ marginTop: 0 }}>
        Cette page permet de <b>modifier</b> le contenu du site : elle ne
        fonctionne que sur ton ordinateur, jamais en ligne (personne d'autre
        ne peut donc toucher à ton site).
      </p>
      <p style={{ marginBottom: 0 }}>
        Ouvre le Terminal dans le dossier du projet et lance{' '}
        <code>npm run admin</code> : le panneau s'ouvre tout seul, avec
        l'édition activée.
      </p>
    </div>
  </div>
);

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
          <span className="admx-soon">bientôt</span>
        </NavLink>

        <div className="admx-side-foot">
          {isReadOnly()
            ? 'Mode consultation en ligne. Pour modifier le contenu, lance « npm run admin » sur ton ordinateur.'
            : 'Modifications enregistrées sur cet ordinateur, publiées seulement via « Publier ».'}
        </div>
      </aside>

      <main className="admx-main">
        <Routes>
          <Route index element={<Protected><DashboardPage /></Protected>} />
          <Route path="contenu" element={<Protected>{isReadOnly() ? <LocalOnly what="Événements & boutique" /> : <Suspense fallback={null}><AdminEvents /></Suspense>}</Protected>} />
          <Route path="discographie" element={<Protected>{isReadOnly() ? <LocalOnly what="Discographie" /> : <Suspense fallback={null}><DiscographyPage /></Suspense>}</Protected>} />
          <Route path="mixtapes" element={<Protected>{isReadOnly() ? <LocalOnly what="Mixtapes" /> : <Suspense fallback={null}><MixtapesPage /></Suspense>}</Protected>} />
          <Route path="seo" element={<Protected><Suspense fallback={null}><SeoPage /></Suspense></Protected>} />
          <Route path="medias" element={<Protected><ComingSoon step="prochaine étape" /></Protected>} />
          <Route path="textes" element={<Protected><ComingSoon step="prochaine étape" /></Protected>} />
          <Route path="publier" element={<Protected><ComingSoon step="prochaine étape" /></Protected>} />
          <Route path="*" element={<Navigate to="/mm-admin" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminApp;
