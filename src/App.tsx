import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Admin from "./components/Admin";
import AdminEvents from "./components/AdminEvents";

import MainApp from "./components/MainApp";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/ms-admin/" element={<Admin />} />
        <Route path="/mm-admin" element={<AdminEvents />} />
      </Routes>
    </Router>
  );
}
