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
    console.log('💾 Sauvegarde des messages dans localStorage...');
    
    // Sauvegarder dans localStorage
    localStorage.setItem('admin_messages_backup', JSON.stringify(messages));
    
    // Déclencher un événement custom pour notifier les autres composants
    const event = new CustomEvent('messagesUpdated', {
      detail: { key: 'messages', data: messages }
    });
    window.dispatchEvent(event);
    
    console.log('✅ Messages sauvegardés dans localStorage');
    console.log('📝 Pour synchroniser avec le fichier JSON, modifie manuellement public/messages.json');
    
    return {
      success: true,
      message: 'Messages sauvegardés ! Modifie public/messages.json pour synchroniser.'
    };
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    return {
      success: false,
      message: 'Erreur lors de la sauvegarde des messages'
    };
  }
};

// Système de synchronisation automatique
let syncInterval: NodeJS.Timeout | null = null;

// Démarrer la synchronisation automatique toutes les 15 secondes
export const startAutoSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  console.log('🔄 Démarrage de la synchronisation automatique (15s)');
  
  syncInterval = setInterval(async () => {
    try {
      const localData = localStorage.getItem('admin_messages_backup');
      if (localData) {
        const messages = JSON.parse(localData);
        console.log('🔄 Synchronisation automatique localStorage → JSON...');
        
        // Sauvegarder réellement dans le fichier JSON via l'API
        try {
          const response = await fetch('http://localhost:3001/api/save-messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages)
          });
          
          if (response.ok) {
            console.log('✅ Synchronisation automatique terminée - Fichier JSON mis à jour');
          } else {
            console.warn('⚠️ Erreur lors de la mise à jour du fichier JSON');
          }
        } catch (error) {
          console.warn('⚠️ Serveur API non disponible, synchronisation locale seulement');
        }
        
        // Déclencher un événement pour notifier les composants
        const event = new CustomEvent('messagesUpdated', {
          detail: { key: 'messages', data: messages }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('❌ Erreur synchronisation automatique:', error);
    }
  }, 15000); // 15 secondes
};

// Arrêter la synchronisation automatique
export const stopAutoSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏹️ Synchronisation automatique arrêtée');
  }
};

// Charger les messages directement depuis le fichier JSON (source unique de vérité)
export const loadMessages = async (): Promise<Message[]> => {
  try {
    console.log('📥 Chargement des messages depuis JSON (source unique)...');
    
    // Charger directement depuis le fichier JSON public avec cache-busting
    const timestamp = Date.now();
    const random = Math.random();
    const response = await fetch(`/messages.json?t=${timestamp}&force=${random}&cache=${Math.random()}`);
    
    if (!response.ok) {
      throw new Error('Erreur lors du chargement des messages');
    }
    const messages = await response.json();
    
    console.log('✅ Messages chargés depuis JSON:', messages.length, 'messages');
    
    // Synchroniser avec localStorage pour la cohérence de l'admin
    localStorage.setItem('admin_messages_backup', JSON.stringify(messages));
    
    // Démarrer la synchronisation automatique
    startAutoSync();
    
    return messages.map((msg: any, index: number) => ({
      ...msg,
      id: msg.id || `msg-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error('❌ Erreur chargement messages:', error);
    
    // En cas d'erreur, essayer localStorage comme fallback
    try {
      const localData = localStorage.getItem('admin_messages_backup');
      if (localData) {
        console.log('⚠️ Fallback vers localStorage');
        const messages = JSON.parse(localData);
        
        // Démarrer la synchronisation automatique même en fallback
        startAutoSync();
        
        return messages.map((msg: any, index: number) => ({
          ...msg,
          id: msg.id || `msg-${Date.now()}-${index}`
        }));
      }
    } catch (e) {
      console.warn('⚠️ Erreur localStorage fallback:', e);
    }
    
    return [];
  }
};

// Sauvegarder les événements directement dans le fichier JSON via l'API
export const saveEvents = async (events: Event[]): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('💾 Sauvegarde des événements via API...');
    
    // Envoyer les données au serveur API
    const response = await fetch('http://localhost:3001/api/save-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(events)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Sauvegarder aussi dans localStorage pour la synchronisation
      localStorage.setItem('admin_events_backup', JSON.stringify(events));
      
      // Déclencher un événement custom pour notifier les autres composants
      const event = new CustomEvent('eventsUpdated', {
        detail: { key: 'events', data: events }
      });
      window.dispatchEvent(event);
      
      console.log('✅ Événements sauvegardés dans events.json');
      return {
        success: true,
        message: 'Événements sauvegardés dans events.json !'
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde des événements:', error);
    return {
      success: false,
      message: 'Erreur lors de la sauvegarde des événements'
    };
  }
};

// Charger les événements depuis l'API
export const loadEvents = async (): Promise<Event[]> => {
  try {
    // Vérifier d'abord s'il y a des modifications dans localStorage
    const savedEvents = localStorage.getItem('admin_events_backup');
    if (savedEvents) {
      console.log('Chargement des événements modifiés depuis localStorage');
      return JSON.parse(savedEvents);
    }
    
    // Sinon, charger depuis le fichier JSON public
    const response = await fetch('/events.json');
    if (!response.ok) {
      throw new Error('Erreur lors du chargement des événements');
    }
    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement des événements:', error);
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

// Sauvegarder le merchandising directement dans le fichier JSON via l'API
export const saveMerchItems = async (merchItems: MerchItem[]): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('💾 Sauvegarde du merchandising via API...');
    
    // Envoyer les données au serveur API
    const response = await fetch('http://localhost:3001/api/save-merch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(merchItems)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Sauvegarder aussi dans localStorage pour la synchronisation
      localStorage.setItem('admin_merch_backup', JSON.stringify(merchItems));
      
      // Déclencher un événement custom pour notifier les autres composants
      const event = new CustomEvent('merchItemsUpdated', {
        detail: { key: 'merchItems', data: merchItems }
      });
      window.dispatchEvent(event);
      
      console.log('✅ Merchandising sauvegardé dans store.json');
      return {
        success: true,
        message: 'Merchandising sauvegardé dans store.json !'
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde du merchandising:', error);
    return {
      success: false,
      message: 'Erreur lors de la sauvegarde du merchandising'
    };
  }
};

// Charger les articles de merchandising depuis l'API
export const loadMerchItems = async (): Promise<MerchItem[]> => {
  try {
    let merchItems: MerchItem[] = [];
    
    // Vérifier d'abord s'il y a des modifications dans localStorage
    const savedMerch = localStorage.getItem('admin_merch_backup');
    if (savedMerch) {
      console.log('Chargement du merchandising modifié depuis localStorage');
      merchItems = JSON.parse(savedMerch);
    } else {
      // Sinon, charger depuis le fichier JSON public
      const response = await fetch('/store.json');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement du merchandising');
      }
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
