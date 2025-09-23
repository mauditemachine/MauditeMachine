// Script pour synchroniser localStorage avec les fichiers JSON
// À exécuter dans la console du navigateur sur ms-admin

function syncLocalStorageToJSON() {
  console.log('🔄 Synchronisation localStorage vers JSON...');
  
  // Fonction pour télécharger un fichier
  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  // Messages
  const messages = localStorage.getItem('admin_messages_backup');
  if (messages) {
    const messagesData = JSON.parse(messages);
    const messagesJSON = JSON.stringify(messagesData, null, 2);
    downloadFile('messages.json', messagesJSON);
    console.log('✅ messages.json téléchargé');
  } else {
    console.log('⚠️ Aucun message trouvé dans localStorage');
  }
  
  // Événements
  const events = localStorage.getItem('admin_events_backup');
  if (events) {
    const eventsData = JSON.parse(events);
    const eventsJSON = JSON.stringify(eventsData, null, 2);
    downloadFile('events.json', eventsJSON);
    console.log('✅ events.json téléchargé');
  } else {
    console.log('⚠️ Aucun événement trouvé dans localStorage');
  }
  
  // Merchandising
  const merch = localStorage.getItem('admin_merch_backup');
  if (merch) {
    const merchData = JSON.parse(merch);
    const merchJSON = JSON.stringify(merchData, null, 2);
    downloadFile('store.json', merchJSON);
    console.log('✅ store.json téléchargé');
  } else {
    console.log('⚠️ Aucun merchandising trouvé dans localStorage');
  }
  
  console.log('🎉 Synchronisation terminée !');
  console.log('📝 Remplacez les fichiers dans public/ et déployez avec ./deploy.sh');
}

// Exécuter la synchronisation
syncLocalStorageToJSON();
