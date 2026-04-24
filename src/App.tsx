import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainApp from "./components/MainApp";
import { AppProvider } from "./context/AppContext";

// Admin panels : lazy load (rarement accedes, ~1750 lignes hors du chunk principal)
const Admin = React.lazy(() => import("./components/Admin"));
const AdminEvents = React.lazy(() => import("./components/AdminEvents"));

export default function App() {
  return (
    <Router>
      <AppProvider>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route
            path="/ms-admin/"
            element={
              <Suspense fallback={null}>
                <Admin />
              </Suspense>
            }
          />
          <Route
            path="/mm-admin"
            element={
              <Suspense fallback={null}>
                <AdminEvents />
              </Suspense>
            }
          />
        </Routes>
      </AppProvider>
    </Router>
  );
}
