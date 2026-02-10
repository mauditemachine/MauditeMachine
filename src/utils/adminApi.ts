// API utilitaire pour l'administration
// Dans un vrai projet, ceci ferait des appels à un backend

export interface Message {
  id: string;
  title: string;
  description: string;
  image: string;
  link?: {
    label: string;
    href: string;
  };
  date: string;
}

export interface Event {
  date: string;
  title: string;
  url: string;
  location: string;
  color: string;
  image: string;
}

// Sauvegarder les messages directement dans localStorage (synchronisation manuelle)
export const saveMessages = async (messages: Message[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(messages);
    try {
      localStorage.setItem('admin_messages_backup', json);
    } catch (e) {
      // localStorage plein - nettoyer et réessayer
      localStorage.removeItem('admin_messages_backup');
      localStorage.setItem('admin_messages_backup', json);
    }
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      try { await fetch('http://localhost:3001/api/save-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json }); } catch (_) {}
    }
    
    window.dispatchEvent(new CustomEvent('messagesUpdated', { detail: { key: 'messages', data: messages } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full, try smaller image') };
  }
};

// Système de synchronisation automatique
let syncInterval: NodeJS.Timeout | null = null;

// Désactiver la synchronisation automatique - sauvegarde manuelle seulement
export const startAutoSync = () => {
  console.log('⏹️ Synchronisation automatique désactivée - Sauvegarde manuelle seulement');
  // Ne fait rien - pas de synchronisation automatique
};

// Arrêter la synchronisation automatique
export const stopAutoSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏹️ Synchronisation automatique arrêtée');
  }
};

// Télécharger le JSON mis à jour pour remplacer le fichier en production
export const downloadUpdatedJSON = (data: any, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log(`📥 Téléchargement de ${filename} pour mise à jour en production`);
};

// Charger les messages - localStorage en priorité (modifications admin), puis JSON comme fallback
export const loadMessages = async (): Promise<Message[]> => {
  try {
    const savedMessages = localStorage.getItem('admin_messages_backup');
    if (savedMessages) {
      const parsed = JSON.parse(savedMessages);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((msg: any, index: number) => ({
          ...msg,
          id: msg.id || `msg-${Date.now()}-${index}`
        }));
      }
    }
    
    const response = await fetch('/messages.json');
    if (!response.ok) throw new Error('Failed');
    const messages = await response.json();
    
    return messages.map((msg: any, index: number) => ({
      ...msg,
      id: msg.id || `msg-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error('Erreur chargement messages:', error);
    return [];
  }
};

export const saveEvents = async (events: Event[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(events);
    try { localStorage.setItem('admin_events_backup', json); } catch (e) { localStorage.removeItem('admin_events_backup'); localStorage.setItem('admin_events_backup', json); }
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) { try { await fetch('http://localhost:3001/api/save-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json }); } catch (_) {} }
    
    window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: { key: 'events', data: events } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full') };
  }
};

export const loadEvents = async (): Promise<Event[]> => {
  try {
    const savedEvents = localStorage.getItem('admin_events_backup');
    if (savedEvents) {
      const parsed = JSON.parse(savedEvents);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    
    const response = await fetch('/events.json');
    if (!response.ok) throw new Error('Failed');
    return await response.json();
  } catch (error) {
    throw error;
  }
};

// Interface pour le merchandising
export interface MerchItem {
  id: number;
  src: string;
  alt: string;
  caption: string;
  price: string;
  category: string;
  active: boolean;
  soldOut: boolean;
  sizes?: {
    S: boolean;
    M: boolean;
    L: boolean;
    XL: boolean;
  };
}

export const saveMerchItems = async (merchItems: MerchItem[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(merchItems);
    try { localStorage.setItem('admin_merch_backup', json); } catch (e) { localStorage.removeItem('admin_merch_backup'); localStorage.setItem('admin_merch_backup', json); }
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) { try { await fetch('http://localhost:3001/api/save-merch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json }); } catch (_) {} }
    
    window.dispatchEvent(new CustomEvent('merchItemsUpdated', { detail: { key: 'merchItems', data: merchItems } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full') };
  }
};

// Charger les articles de merchandising depuis l'API
export const loadMerchItems = async (): Promise<MerchItem[]> => {
  try {
    let merchItems: MerchItem[] = [];
    
    const savedMerch = localStorage.getItem('admin_merch_backup');
    if (savedMerch) {
      const parsed = JSON.parse(savedMerch);
      if (Array.isArray(parsed) && parsed.length > 0) {
        merchItems = parsed;
      }
    }
    
    if (merchItems.length === 0) {
      const response = await fetch('/store.json');
      if (!response.ok) throw new Error('Failed');
      merchItems = await response.json();
    }
    
    // Nettoyer automatiquement les noms avec "- Front" et initialiser les tailles
    const cleanedItems = merchItems.map(item => ({
      ...item,
      caption: item.caption?.replace(/\s*-\s*Front\s*$/i, '').trim() || item.caption,
      sizes: item.sizes || {
        S: true,
        M: true,
        L: true,
        XL: true
      }
    }));
    
    // Si des noms ont été nettoyés, sauvegarder automatiquement
    const hasChanges = cleanedItems.some((item, index) => 
      item.caption !== merchItems[index].caption
    );
    
    if (hasChanges) {
      console.log('Nettoyage automatique des noms avec "- Front"');
      await saveMerchItems(cleanedItems);
      return cleanedItems;
    }
    
    return merchItems;
  } catch (error) {
    console.error('Erreur lors du chargement du merchandising:', error);
    throw error;
  }
};
