/**
 * /mm-admin/radar — le tableau de bord Radar, deplace dans l'admin.
 *
 * C'est l'outil de veille perso (flux des sorties, explorateur iTunes,
 * ecoute integree) : il n'est plus une page publique du site. Le composant
 * RadarPage est reutilise tel quel via son topSlot ; cette page ajoute le
 * rideau d'acces (AdminCurtain, ouvert en localhost) et la navigation
 * admin. La GESTION des releases (ajout, edition, import JSON) reste dans
 * l'onglet releases de /mm-admin (Contenu).
 */

import React from 'react';
import AdminCurtain from '../components/ui/AdminCurtain';
import AdminNav from '../components/ui/AdminNav';
import RadarPage from './RadarPage';

const AdminRadarPage: React.FC = () => (
  <AdminCurtain>
    <RadarPage topSlot={<AdminNav />} />
  </AdminCurtain>
);

export default AdminRadarPage;
