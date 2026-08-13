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
// Le site principal depuis la bascule (2026-08) : la refonte v2
const V2App = React.lazy(() => import('./v2/V2App'));
const V2RadarPage = React.lazy(() => import('./v2/pages/RadarPage'));
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
          {/* ============ Site principal : la v2 ============ */}
          <Route path="/" element={lazyEl(<V2App />)} />
          <Route path="/radar" element={lazyEl(<V2RadarPage />)} />
          {/* Compat : les liens /v2 deja partages restent valides */}
          <Route path="/v2" element={<Navigate to="/" replace />} />
          <Route path="/v2/radar" element={<Navigate to="/radar" replace />} />

          {/* ============ Redirections des anciennes URLs v1 ============ */}
          <Route path="/about" element={<Navigate to="/#epk" replace />} />
          <Route path="/shows" element={<Navigate to="/#live" replace />} />
          <Route path="/merch" element={<Navigate to="/#merch" replace />} />
          <Route path="/goodies" element={<Navigate to="/#merch" replace />} />
          <Route path="/techrider" element={<Navigate to="/#epk" replace />} />
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />

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
