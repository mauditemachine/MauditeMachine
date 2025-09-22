// Script pour synchroniser les données de production
const fs = require('fs');
const https = require('https');

// Fonction pour récupérer les données de production
function fetchProductionData() {
  return new Promise((resolve, reject) => {
    https.get('https://mauditemachine.com/messages.json', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const messages = JSON.parse(data);
          resolve(messages);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Fonction pour mettre à jour les fichiers
async function syncData() {
  try {
    console.log('🔄 Récupération des données de production...');
    const messages = await fetchProductionData();
    
    console.log('📝 Messages récupérés:', messages.length);
    console.log('Messages:', JSON.stringify(messages, null, 2));
    
    // Mettre à jour public/messages.json
    fs.writeFileSync('public/messages.json', JSON.stringify(messages, null, 2));
    console.log('✅ public/messages.json mis à jour');
    
    // Mettre à jour medias/messages.json
    fs.writeFileSync('medias/messages.json', JSON.stringify(messages, null, 2));
    console.log('✅ medias/messages.json mis à jour');
    
    console.log('🎉 Synchronisation terminée !');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

syncData();
