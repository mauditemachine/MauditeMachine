// Script pour forcer la synchronisation des données de l'admin
const fs = require('fs');
const https = require('https');

// Fonction pour récupérer les données de l'admin
function fetchAdminData() {
  return new Promise((resolve, reject) => {
    https.get('https://mauditemachine.com/ms-admin', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          // Chercher les données dans le HTML de l'admin
          const match = data.match(/admin_messages_backup['"]\s*:\s*['"]([^'"]+)['"]/);
          if (match) {
            const encodedData = match[1];
            const decodedData = decodeURIComponent(encodedData);
            const messages = JSON.parse(decodedData);
            resolve(messages);
          } else {
            // Fallback vers les messages par défaut
            resolve([
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
            ]);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Fonction pour mettre à jour les fichiers
async function forceSync() {
  try {
    console.log('🔄 Récupération des données de l\'admin...');
    const messages = await fetchAdminData();
    
    console.log('📝 Messages récupérés:', messages.length);
    console.log('Messages:', JSON.stringify(messages, null, 2));
    
    // Mettre à jour public/messages.json
    fs.writeFileSync('public/messages.json', JSON.stringify(messages, null, 2));
    console.log('✅ public/messages.json mis à jour');
    
    // Mettre à jour medias/messages.json
    fs.writeFileSync('medias/messages.json', JSON.stringify(messages, null, 2));
    console.log('✅ medias/messages.json mis à jour');
    
    console.log('🎉 Synchronisation forcée terminée !');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

forceSync();