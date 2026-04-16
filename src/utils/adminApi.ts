// API utilitaire pour l'administration
// En local: sauvegarde via server.js (localhost:3001)
// En production: sauvegarde via API Render → commit GitHub → auto-deploy

const PROD_API_URL = import.meta.env.VITE_API_URL || '';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

function getApiUrl(): string {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalhost ? 'http://localhost:3001' : PROD_API_URL;
}

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost && ADMIN_API_KEY) {
    headers['x-api-key'] = ADMIN_API_KEY;
  }
  return headers;
}

async function callApi(endpoint: string, data: any): Promise<boolean> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return false;
  try {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return true;
  } catch (err) {
    console.warn(`API save failed (${endpoint}):`, err);
    return false;
  }
}

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
  main?: boolean; // News principale affichée 20s en premier
}

export interface Event {
  date: string;
  title: string;
  url: string;
  location: string;
  color: string;
  image: string;
}

// Sauvegarder les messages - localStorage TOUJOURS (persistance admin), + API si localhost
export const saveMessages = async (messages: Message[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(messages, null, 2);
    try {
      localStorage.setItem('admin_messages_backup', json);
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError') {
        localStorage.removeItem('admin_messages_backup');
        try { localStorage.setItem('admin_messages_backup', json); } catch (_) {
          return { success: false, message: 'Storage full - reduce image size' };
        }
      } else throw e;
    }
    await callApi('/api/save-messages', messages);
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

// Charger les messages - forAdmin: backup localStorage (admin); site public: TOUJOURS JSON
export const loadMessages = async (forAdmin = false): Promise<Message[]> => {
  try {
    if (forAdmin) {
      const backup = localStorage.getItem('admin_messages_backup');
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed)) {
            return parsed.map((msg: any, index: number) => ({
              ...msg,
              id: msg.id || `msg-${Date.now()}-${index}`
            }));
          }
        } catch (_) {}
      }
    }
    const response = await fetch(`/messages.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed');
    const messages = await response.json();
    return messages.map((msg: any, index: number) => ({
      ...msg,
      id: msg.id || `msg-${Date.now()}-${index}`
    }));
  } catch (error) {
    return [];
  }
};

export const saveEvents = async (events: Event[]): Promise<{ success: boolean; message: string }> => {
  try {
    const json = JSON.stringify(events, null, 2);
    try { localStorage.setItem('admin_events_backup', json); } catch (e: any) {
      if (e?.name === 'QuotaExceededError') { localStorage.removeItem('admin_events_backup'); localStorage.setItem('admin_events_backup', json); } else throw e;
    }
    await callApi('/api/save-events', events);
    window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: { key: 'events', data: events } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full') };
  }
};

// Charger les events - forAdmin: backup localStorage; site public: TOUJOURS JSON
export const loadEvents = async (forAdmin = false): Promise<Event[]> => {
  try {
    if (forAdmin) {
      const backup = localStorage.getItem('admin_events_backup');
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
      }
    }
    const response = await fetch(`/events.json?t=${Date.now()}`);
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
    const json = JSON.stringify(merchItems, null, 2);
    try { localStorage.setItem('admin_merch_backup', json); } catch (e: any) {
      if (e?.name === 'QuotaExceededError') { localStorage.removeItem('admin_merch_backup'); localStorage.setItem('admin_merch_backup', json); } else throw e;
    }
    await callApi('/api/save-merch', merchItems);
    window.dispatchEvent(new CustomEvent('merchItemsUpdated', { detail: { key: 'merchItems', data: merchItems } }));
    return { success: true, message: 'Saved!' };
  } catch (error: any) {
    return { success: false, message: 'Error: ' + (error.message || 'Storage full') };
  }
};

// Charger le merchandising - forAdmin: backup; site public: TOUJOURS JSON
export const loadMerchItems = async (forAdmin = false): Promise<MerchItem[]> => {
  try {
    if (forAdmin) {
      const backup = localStorage.getItem('admin_merch_backup');
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (Array.isArray(parsed)) {
            return parsed.map(item => ({
              ...item,
              sizes: item.sizes || { S: true, M: true, L: true, XL: true }
            }));
          }
        } catch (_) {}
      }
    }
    const response = await fetch(`/store.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed');
    let merchItems = await response.json();
    const cleanedItems = merchItems.map((item: MerchItem) => ({
      ...item,
      caption: item.caption?.replace(/\s*-\s*Front\s*$/i, '').trim() || item.caption,
      sizes: item.sizes || { S: true, M: true, L: true, XL: true }
    }));
    const hasChanges = cleanedItems.some((item: MerchItem, index: number) => item.caption !== merchItems[index].caption);
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (hasChanges && isLocalhost) {
      await saveMerchItems(cleanedItems);
      return cleanedItems;
    }
    return cleanedItems;
  } catch (error) {
    console.error('Erreur lors du chargement du merchandising:', error);
    throw error;
  }
};
