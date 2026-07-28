import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AdminGate from './components/ui/AdminGate';
import { AppProvider } from './context/AppContext';

// Pages : lazy load pour code-splitting (chargees a la demande)
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ShowsPage = React.lazy(() => import('./pages/ShowsPage'));
const MerchPage = React.lazy(() => import('./pages/MerchPage'));
const GoodiesPage = React.lazy(() => import('./pages/GoodiesPage'));
const TechRiderPage = React.lazy(() => import('./pages/TechRiderPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const RadarPage = React.lazy(() => import('./pages/RadarPage'));

// Admin panels : lazy load (panels internes, ~1750 lignes hors du chunk principal)
const Admin = React.lazy(() => import('./components/Admin'));
const AdminEvents = React.lazy(() => import('./components/AdminEvents'));

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
            <Route
              path="radar"
              element={
                <Suspense fallback={null}>
                  <RadarPage />
                </Suspense>
              }
            />
          </Route>

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
            path="/mm-admin"
            element={
              <Suspense fallback={null}>
                <AdminGate>
                  <AdminEvents />
                </AdminGate>
              </Suspense>
            }
          />
        </Routes>
      </AppProvider>
    </Router>
  );
}
