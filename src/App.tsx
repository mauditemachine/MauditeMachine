import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AdminGate from './components/ui/AdminGate';
import { AppProvider } from './context/AppContext';
const AdminStatsPage = React.lazy(() => import('./pages/AdminStatsPage'));

// Pages v1 (archivees sous /v1) : lazy load pour code-splitting
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ShowsPage = React.lazy(() => import('./pages/ShowsPage'));
const MerchPage = React.lazy(() => import('./pages/MerchPage'));
const GoodiesPage = React.lazy(() => import('./pages/GoodiesPage'));
const TechRiderPage = React.lazy(() => import('./pages/TechRiderPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const AdminRadarPage = React.lazy(() => import('./pages/AdminRadarPage'));
// La v2 (site principal de 2026-08 a 2026-09) : archivee sous /v2
const V2App = React.lazy(() => import('./v2/V2App'));
const V2RadarPage = React.lazy(() => import('./v2/pages/RadarPage'));
const V2TechRiderPage = React.lazy(() => import('./v2/pages/TechRiderPage'));
// Experiment v3 : Acid Line, hors sitemap (chunk lazy, v1 et v2 n'en chargent rien)
const V3App = React.lazy(() => import('./v3/V3App'));
// Le site principal depuis 2026-09-30 : la machine MM-808 (chunk lazy)
const V4App = React.lazy(() => import('./v4/index'));
// Panneau admin local (shell sidebar : dashboard, contenu, medias, publier)
const AdminApp = React.lazy(() => import('./admin/AdminApp'));

// Admin panels : lazy load (panels internes, ~1750 lignes hors du chunk principal)
const Admin = React.lazy(() => import('./components/Admin'));

const lazyEl = (node: React.ReactNode) => <Suspense fallback={null}>{node}</Suspense>;

export default function App() {
  return (
    <Router>
      <AppProvider>
        <Routes>
          {/* ============ Site principal : la machine MM-808 (v4) ============ */}
          <Route path="/" element={lazyEl(<V4App />)} />
          <Route path="/radar" element={lazyEl(<V2RadarPage />)} />
          <Route path="/techrider" element={lazyEl(<V2TechRiderPage />)} />
          <Route path="/v3" element={lazyEl(<V3App />)} />
          {/* Compat : les liens /v4 deja partages menent a l'accueil */}
          <Route path="/v4" element={<Navigate to="/" replace />} />
          {/* La v2 archivee, navigable sous /v2 */}
          <Route path="/v2" element={lazyEl(<V2App />)} />
          {/* La page Archives (musee du site) a ete retiree : on ne laisse
              pas une page blanche aux liens deja partages ou indexes. */}
          <Route path="/archives" element={<Navigate to="/" replace />} />
          <Route path="/v2/radar" element={<Navigate to="/radar" replace />} />

          {/* ============ Redirections des anciennes URLs v1 ============ */}
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/shows" element={<Navigate to="/" replace />} />
          <Route path="/merch" element={<Navigate to="/" replace />} />
          <Route path="/goodies" element={<Navigate to="/" replace />} />
          <Route path="/contact" element={<Navigate to="/" replace />} />

          {/* ============ v1 archivee, navigable sous /v1 (noindex) ============ */}
          <Route path="/v1" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={lazyEl(<AboutPage />)} />
            <Route path="shows" element={lazyEl(<ShowsPage />)} />
            <Route path="merch" element={lazyEl(<MerchPage />)} />
            <Route path="goodies" element={lazyEl(<GoodiesPage />)} />
            <Route path="techrider" element={lazyEl(<TechRiderPage />)} />
            <Route path="contact" element={lazyEl(<ContactPage />)} />
          </Route>

          {/* ============ Admin (inchange) ============ */}
          {/* Le radar admin garde le Layout v1 : son lecteur global
              (PlayerProvider) y vit. */}
          <Route path="/mm-admin/radar" element={<Layout />}>
            <Route index element={lazyEl(<AdminRadarPage />)} />
          </Route>
          <Route
            path="/ms-admin/"
            element={lazyEl(
              <AdminGate>
                <Admin />
              </AdminGate>
            )}
          />
          <Route path="/mm-admin/stats" element={lazyEl(<AdminStatsPage />)} />
          {/* Shell admin : la route statique stats ci-dessus gagne sur le
              splat (ranking React Router). */}
          <Route path="/mm-admin/*" element={lazyEl(<AdminApp />)} />
        </Routes>
      </AppProvider>
    </Router>
  );
}
