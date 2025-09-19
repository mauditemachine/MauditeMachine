// API utilitaire pour l'administration
// Dans un vrai projet, ceci ferait des appels à un backend

export interface Message {
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
      return JSON.parse(savedMessages);
    }
    
    // Sinon, charger depuis le fichier JSON public
    const response = await fetch('/messages.json');
    if (!response.ok) {
      throw new Error('Erreur lors du chargement des messages');
    }
    return await response.json();
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
