// Script pour synchroniser les données de l'admin avec les fichiers JSON
const fs = require('fs');
const path = require('path');

// Fonction pour récupérer les données de l'admin depuis localStorage
function getAdminData() {
  console.log('🔍 Récupération des données de l\'admin...');
  
  // Simuler la récupération des données de l'admin
  // En réalité, il faudrait accéder au localStorage de l'admin
  const adminMessages = [
    {
      "id": "msg-1",
      "title": "New Album Soon",
      "description": "10 fresh tracks landing this September",
      "image": "images/Simetra.webp",
      "link": { "label": "", "href": "" },
      "date": "2024-12-01"
    },
    {
      "id": "msg-2", 
      "title": "Merch Drop Coming Soon",
      "description": "T-shirts, hoodies & stickers coming soon",
      "image": "images/stickers.webp",
      "date": "2024-12-10"
    },
    {
      "id": "msg-3",
      "title": "Learn Ableton Live", 
      "description": "Ableton Live 12 courses available in Montreal. Book your spot now!",
      "image": "images/AbletonSchool.png",
      "link": { "label": "Contact", "href": "https://ableton.school/" },
      "date": "2024-12-15"
    },
    {
      "id": "msg-4",
      "title": "Mixtape 37 Out Now",
      "description": "Latest mixtape ! mixtape 37 is out now ! listen now", 
      "image": "images/mixtape37.webp",
      "link": { "label": "Soundcloud", "href": "https://soundcloud.com/mauditemachine/maudite-machine-mixtape-37" },
      "date": "2025-01-15"
    }
  ];

  return adminMessages;
}

// Fonction pour mettre à jour les fichiers JSON
function updateJsonFiles() {
  const adminMessages = getAdminData();
  
  // Mettre à jour public/messages.json
  const publicPath = path.join(__dirname, 'public', 'messages.json');
  fs.writeFileSync(publicPath, JSON.stringify(adminMessages, null, 2));
  console.log('✅ public/messages.json mis à jour');
  
  // Mettre à jour medias/messages.json
  const mediasPath = path.join(__dirname, 'medias', 'messages.json');
  fs.writeFileSync(mediasPath, JSON.stringify(adminMessages, null, 2));
  console.log('✅ medias/messages.json mis à jour');
  
  console.log('🎉 Synchronisation terminée !');
}

// Exécuter la synchronisation
updateJsonFiles();
