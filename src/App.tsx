import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AdminGate from './components/ui/AdminGate';
import { AppProvider } from './context/AppContext';
const AdminStatsPage = React.lazy(() => import('./pages/AdminStatsPage'));

// Pages : lazy load pour code-splitting (chargees a la demande)
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ShowsPage = React.lazy(() => import('./pages/ShowsPage'));
const MerchPage = React.lazy(() => import('./pages/MerchPage'));
const GoodiesPage = React.lazy(() => import('./pages/GoodiesPage'));
const TechRiderPage = React.lazy(() => import('./pages/TechRiderPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const AdminRadarPage = React.lazy(() => import('./pages/AdminRadarPage'));
// Refonte /v2 : one-page isolee, hors Layout (nav + player + fond propres)
const V2App = React.lazy(() => import('./v2/V2App'));
const V2RadarPage = React.lazy(() => import('./v2/pages/RadarPage'));
// Panneau admin local (shell sidebar : dashboard, contenu, medias, publier)
const AdminApp = React.lazy(() => import('./admin/AdminApp'));

// Admin panels : lazy load (panels internes, ~1750 lignes hors du chunk principal)
const Admin = React.lazy(() => import('./components/Admin'));

export default function App() {
  return (
    <Router>
      <AppProvider>
        <Routes>
          {/* Layout shell persistant (header + bg video + audio player) */}
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route
              path="about"
              element={
                <Suspense fallback={null}>
                  <AboutPage />
                </Suspense>
              }
            />
            <Route
              path="shows"
              element={
                <Suspense fallback={null}>
                  <ShowsPage />
                </Suspense>
              }
            />
            <Route
              path="merch"
              element={
                <Suspense fallback={null}>
                  <MerchPage />
                </Suspense>
              }
            />
            <Route
              path="goodies"
              element={
                <Suspense fallback={null}>
                  <GoodiesPage />
                </Suspense>
              }
            />
            <Route
              path="techrider"
              element={
                <Suspense fallback={null}>
                  <TechRiderPage />
                </Suspense>
              }
            />
            <Route
              path="contact"
              element={
                <Suspense fallback={null}>
                  <ContactPage />
                </Suspense>
              }
            />
            {/* Le Radar est devenu un outil d'admin : l'ancienne URL
                publique redirige vers la home. */}
            <Route path="radar" element={<Navigate to="/" replace />} />
            {/* Dans le Layout expres : le lecteur global (PlayerProvider)
                et le fond du site y vivent. */}
            <Route
              path="mm-admin/radar"
              element={
                <Suspense fallback={null}>
                  <AdminRadarPage />
                </Suspense>
              }
            />
          </Route>

          {/* Refonte /v2 en preview (hors Layout : elle a sa propre nav,
              son propre player et son propre fond). noindex pose par V2App. */}
          <Route
            path="/v2"
            element={
              <Suspense fallback={null}>
                <V2App />
              </Suspense>
            }
          />
          <Route
            path="/v2/radar"
            element={
              <Suspense fallback={null}>
                <V2RadarPage />
              </Suspense>
            }
          />

          {/* Admin routes (hors Layout, panels independants).
              AdminGate = ecran de login. Le verrou reel est cote serveur :
              toute ecriture sans le bon secret repond 401. */}
          <Route
            path="/ms-admin/"
            element={
              <Suspense fallback={null}>
                <AdminGate>
                  <Admin />
                </AdminGate>
              </Suspense>
            }
          />
          <Route
            path="/mm-admin/stats"
            element={
              <Suspense fallback={null}>
                <AdminStatsPage />
              </Suspense>
            }

          />

          {/* Shell admin : dashboard + sections. Les routes statiques
              /mm-admin/stats et /mm-admin/radar ci-dessus gagnent sur le
              splat (ranking React Router), rien ne change pour elles. */}
          <Route
            path="/mm-admin/*"
            element={
              <Suspense fallback={null}>
                <AdminApp />
              </Suspense>
            }
          />
        </Routes>
      </AppProvider>
    </Router>
  );
}
