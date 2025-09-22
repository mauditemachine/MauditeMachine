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

// Simuler une sauvegarde des messages
export const saveMessages = async (messages: Message[]): Promise<{ success: boolean; message: string }> => {
  try {
    // Simulation d'un délai de réseau
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dans un vrai projet, vous feriez ici un appel API :
    // const response = await fetch('/api/messages', {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(messages)
    // });
    
    // Pour l'instant, on simule juste une sauvegarde réussie
    console.log('Messages à sauvegarder:', messages);
    
    // Vous pourriez aussi sauvegarder dans localStorage pour les tests
    localStorage.setItem('admin_messages_backup', JSON.stringify(messages));
    
    return {
      success: true,
      message: 'Messages sauvegardés avec succès !'
    };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    return {
      success: false,
      message: 'Erreur lors de la sauvegarde des messages'
    };
  }
};

// Charger les messages depuis l'API
export const loadMessages = async (): Promise<Message[]> => {
  try {
    // Vérifier d'abord s'il y a des modifications dans localStorage
    const savedMessages = localStorage.getItem('admin_messages_backup');
    if (savedMessages) {
      console.log('Chargement des messages modifiés depuis localStorage');
      const messages = JSON.parse(savedMessages);
      // Ajouter des IDs aux messages qui n'en ont pas
      return messages.map((msg: any, index: number) => ({
        ...msg,
        id: msg.id || `msg-${Date.now()}-${index}`
      }));
    }
    
    // Sinon, charger depuis le fichier JSON public
    const response = await fetch('/messages.json');
    if (!response.ok) {
      throw new Error('Erreur lors du chargement des messages');
    }
    const messages = await response.json();
    // Ajouter des IDs aux messages qui n'en ont pas
    return messages.map((msg: any, index: number) => ({
      ...msg,
      id: msg.id || `msg-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error('Erreur lors du chargement des messages:', error);
    throw error;
  }
};

// Simuler une sauvegarde des événements
export const saveEvents = async (events: Event[]): Promise<{ success: boolean; message: string }> => {
  try {
    // Simulation d'un délai de réseau
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dans un vrai projet, vous feriez ici un appel API :
    // const response = await fetch('/api/events', {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(events)
    // });
    
    // Pour l'instant, on simule juste une sauvegarde réussie
    console.log('Événements à sauvegarder:', events);
    
    // Sauvegarder dans localStorage pour les tests
    localStorage.setItem('admin_events_backup', JSON.stringify(events));
    
    return {
      success: true,
      message: 'Événements sauvegardés avec succès !'
    };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des événements:', error);
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
}

// Simuler une sauvegarde du merchandising
export const saveMerchItems = async (merchItems: MerchItem[]): Promise<{ success: boolean; message: string }> => {
  try {
    // Simulation d'un délai de réseau
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Pour l'instant, on simule juste une sauvegarde réussie
    console.log('Articles de merchandising à sauvegarder:', merchItems);
    
    // Sauvegarder dans localStorage pour les tests
    localStorage.setItem('admin_merch_backup', JSON.stringify(merchItems));
    
    return {
      success: true,
      message: 'Merchandising sauvegardé avec succès !'
    };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du merchandising:', error);
    return {
      success: false,
      message: 'Erreur lors de la sauvegarde du merchandising'
    };
  }
};

// Charger les articles de merchandising depuis l'API
export const loadMerchItems = async (): Promise<MerchItem[]> => {
  try {
    // Vérifier d'abord s'il y a des modifications dans localStorage
    const savedMerch = localStorage.getItem('admin_merch_backup');
    if (savedMerch) {
      console.log('Chargement du merchandising modifié depuis localStorage');
      return JSON.parse(savedMerch);
    }
    
    // Sinon, charger depuis le fichier JSON public
    const response = await fetch('/store.json');
    if (!response.ok) {
      throw new Error('Erreur lors du chargement du merchandising');
    }
    return await response.json();
  } catch (error) {
    console.error('Erreur lors du chargement du merchandising:', error);
    throw error;
  }
};
