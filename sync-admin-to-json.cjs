#!/usr/bin/env node

// Script pour synchroniser les données admin (localStorage) vers les fichiers JSON publics
// Usage: node sync-admin-to-json.cjs

import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

// Fonction pour mettre à jour un fichier JSON
const updateJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`✅ ${filePath} mis à jour`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour de ${filePath}:`, error);
    return false;
  }
};

// Fonction pour lire les données depuis localStorage (simulation)
const getLocalStorageData = (key) => {
  try {
    // En production, on récupérerait depuis le localStorage du navigateur
    // Pour l'instant, on simule avec des données de test
    console.log(`📖 Lecture des données ${key} depuis localStorage...`);
    
    // Simulation - en réalité il faudrait récupérer depuis le navigateur
    return null; // Pas de données localStorage simulées pour l'instant
  } catch (error) {
    console.error(`❌ Erreur lecture localStorage ${key}:`, error);
    return null;
  }
};

// Fonction principale de synchronisation
const syncAdminData = async () => {
  console.log('🔄 Synchronisation des données admin vers JSON...');
  
  // 1. Messages
  const messagesData = getLocalStorageData('admin_messages_backup');
  if (messagesData) {
    const publicPath = path.join(__dirname, 'public', 'messages.json');
    const mediasPath = path.join(__dirname, 'medias', 'messages.json');
    
    updateJsonFile(publicPath, messagesData);
    updateJsonFile(mediasPath, messagesData);
  } else {
    console.log('ℹ️  Aucune donnée messages dans localStorage');
  }
  
  // 2. Événements
  const eventsData = getLocalStorageData('admin_events_backup');
  if (eventsData) {
    const publicPath = path.join(__dirname, 'public', 'events.json');
    const mediasPath = path.join(__dirname, 'medias', 'events.json');
    
    updateJsonFile(publicPath, eventsData);
    updateJsonFile(mediasPath, eventsData);
  } else {
    console.log('ℹ️  Aucune donnée événements dans localStorage');
  }
  
  // 3. Merchandising
  const merchData = getLocalStorageData('admin_merch_backup');
  if (merchData) {
    const publicPath = path.join(__dirname, 'public', 'store.json');
    const mediasPath = path.join(__dirname, 'medias', 'store.json');
    
    updateJsonFile(publicPath, merchData);
    updateJsonFile(mediasPath, merchData);
  } else {
    console.log('ℹ️  Aucune donnée merchandising dans localStorage');
  }
  
  console.log('🎉 Synchronisation terminée !');
  console.log('💡 Pour synchroniser les vraies données, utilise le navigateur pour exporter localStorage');
};

// Exécuter la synchronisation
syncAdminData().catch(console.error);
