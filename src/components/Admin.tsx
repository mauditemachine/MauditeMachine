import React, { useState, useEffect, useRef } from 'react';
import { Message, Event, MerchItem, loadMessages, saveMessages, loadEvents, saveEvents, loadMerchItems, saveMerchItems } from '../utils/adminApi';
import ImageUpload from './ImageUpload';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


interface Bio {
  text: string;
}

// Composant pour les messages sortables
const SortableMessage: React.FC<{
  message: Message;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleExpand: (id: string) => void;
  isExpanded: boolean;
  onUpdate: (index: number, field: keyof Message, value: string) => void;
  onSave: () => void;
  saving: boolean;
  index: number;
}> = ({ message, onEdit, onDelete, onToggleExpand, isExpanded, onUpdate, onSave, saving, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: message.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`admin-accordion-item ${isExpanded ? 'expanded' : ''}`}
    >
      <div 
        className="admin-accordion-header"
        onClick={() => onToggleExpand(message.id)}
      >
        <div className="accordion-info">
          <h3 className="accordion-title">
            Message {index + 1}
            {message.title && <span className="title-preview">: {message.title}</span>}
          </h3>
          <div className="accordion-meta">
            <span className="meta-date">{message.date}</span>
            {message.description && (
              <span className="meta-description">
                {message.description.substring(0, 50)}...
              </span>
            )}
          </div>
        </div>
        
        <div className="accordion-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(message.id);
            }}
            className="admin-btn danger small admin-btn-custom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-delete">
              <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/>
            </svg>
          </button>
          
          <button className="admin-btn secondary small admin-btn-custom">
            {isExpanded ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
              <path d="M297.4 105.4C309.9 92.9 330.2 92.9 342.7 105.4L502.7 265.4C511.9 274.6 514.6 288.3 509.6 300.3C504.6 312.3 492.9 320 480 320L384 320L384 496C384 522.5 362.5 544 336 544L304 544C277.5 544 256 522.5 256 496L256 320L160 320C147.1 320 135.4 312.2 130.4 300.2C125.4 288.2 128.2 274.5 137.4 265.4L297.4 105.4z"/>
            </svg> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-open">
              <path d="M88 289.6L64.4 360.2L64.4 160C64.4 124.7 93.1 96 128.4 96L267.1 96C280.9 96 294.4 100.5 305.5 108.8L343.9 137.6C349.4 141.8 356.2 144 363.1 144L480.4 144C515.7 144 544.4 172.7 544.4 208L544.4 224L179 224C137.7 224 101 250.4 87.9 289.6zM509.8 512L131 512C98.2 512 75.1 479.9 85.5 448.8L133.5 304.8C140 285.2 158.4 272 179 272L557.8 272C590.6 272 613.7 304.1 603.3 335.2L555.3 479.2C548.8 498.8 530.4 512 509.8 512z"/>
            </svg>}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className={`admin-accordion-content ${isExpanded ? 'expanded' : ''}`}>
          <div className="accordion-form">
            <div className="form-row">
              <div className="form-group">
                <label>Titre</label>
                <input
                  type="text"
                  value={message.title}
                  onChange={(e) => onUpdate(index, 'title', e.target.value)}
                  placeholder="Titre du message"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={message.description}
                  onChange={(e) => onUpdate(index, 'description', e.target.value)}
                  rows={3}
                  placeholder="Description du message"
                />
              </div>
            </div>

            <div className="form-row">
              <ImageUpload
                value={message.image}
                onChange={(value) => onUpdate(index, 'image', value)}
                placeholder="ex: images/Simetra.webp"
              />
            </div>

            <div className="form-row two-cols">
              <div className="form-group">
                <label>Label du lien</label>
                <input
                  type="text"
                  value={message.link?.label || ''}
                  onChange={(e) => onUpdate(index, 'link' as keyof Message, `label|${e.target.value}`)}
                  placeholder="ex: Soundcloud"
                />
              </div>
              <div className="form-group">
                <label>URL du lien</label>
                <input
                  type="url"
                  value={message.link?.href || ''}
                  onChange={(e) => onUpdate(index, 'link' as keyof Message, `href|${e.target.value}`)}
                  placeholder="ex: https://soundcloud.com/..."
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={message.date}
                  onChange={(e) => onUpdate(index, 'date', e.target.value)}
                />
              </div>
            </div>
            
                                {/* Sauvegarde automatique - plus de bouton nécessaire */}
          </div>
        </div>
      )}
      
      {/* Handle de drag & drop */}
      <div 
        className="drag-handle" 
        {...attributes}
        {...listeners}
        style={{ 
          position: 'absolute', 
          right: '10px', 
          top: '50%', 
          transform: 'translateY(-50%)',
          cursor: 'grab',
          padding: '5px',
          color: '#666'
        }}
      >
        ⋮⋮
      </div>
    </div>
  );
};


const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'messages' | 'events' | 'store' | 'bio'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [bio, setBio] = useState<Bio>({ text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Capteurs pour le drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fonction de gestion du drag & drop
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const newMessages = arrayMove(
        messages,
        messages.findIndex((item) => item.id === active.id),
        messages.findIndex((item) => item.id === over.id)
      );
      
      setMessages(newMessages);
      
      // Sauvegarder automatiquement après le drag & drop
      try {
        setSaving(true);
        const result = await saveMessages(newMessages);
        if (result.success) {
          setMessage('Ordre des messages sauvegardé !');
          setTimeout(() => setMessage(''), 3000);
        } else {
          setMessage('Erreur lors de la sauvegarde');
          setTimeout(() => setMessage(''), 3000);
        }
      } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        setMessage('Erreur lors de la sauvegarde');
        setTimeout(() => setMessage(''), 3000);
      } finally {
        setSaving(false);
      }
    }
  };
  
  // Refs supprimés - plus d'animations GSAP

  // Pas d'animation d'entrée - chargement direct

  // Animation lors du changement d'onglet - désactivée pour éviter les conflits
  // useEffect(() => {
  //   if (contentRef.current && !loading) {
  //     gsap.fromTo(contentRef.current.children,
  //       { y: 20, opacity: 0 },
  //       { 
  //         y: 0, 
  //         opacity: 1, 
  //         duration: 0.4, 
  //         stagger: 0.1, 
  //         ease: "power2.out"
  //       }
  //     );
  //   }
  // }, [activeTab]);

  // Charger les données depuis l'API
  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les messages
        const messagesData = await loadMessages();
        // Trier les messages dans le même ordre que sur le site (par date décroissante)
        const sortedMessages = Array.isArray(messagesData) ? messagesData.sort((a, b) => {
          const dateA = new Date(a.date || '1970-01-01').getTime();
          const dateB = new Date(b.date || '1970-01-01').getTime();
          return dateB - dateA; // Ordre décroissant (plus récent en premier)
        }) : [];
        setMessages(sortedMessages);
        
        // Charger les événements
        const eventsData = await loadEvents();
        setEvents(eventsData);
        
        // Charger le merchandising
        const merchData = await loadMerchItems();
        setMerchItems(merchData);
        
        // Charger la bio depuis localStorage ou valeur par défaut
        const savedBio = localStorage.getItem('admin_bio_backup');
        if (savedBio) {
          setBio(JSON.parse(savedBio));
        } else {
          setBio({ 
            text: "Maudite Machine is a Canadian DJ and producer known for his raw, hypnotic approach to minimal and indie dance. Born from the Montreal underground, he has performed at major events including Piknic Électronik, Eclipse Festival, and the iconic Techno Parade in Paris, delivering sets that blur the line between intensity and atmosphere across Canada and Europe.\n\nAs the founder of VRSTL Records, he curates a sound that embraces tension, groove, and experimentation, having shared the stage with electronic music legends like Carl Craig, Ellen Allien, The Hacker, Popof, and Agoria. His collaborations with influential artists reflect a constant drive to push boundaries and redefine the underground with a distinct sonic signature, championing bold artists who share his vision for the darker, experimental sides of electronic music." 
          });
        }

        
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setMessage('Erreur lors du chargement des données');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Fonction pour basculer l'accordéon
  const toggleAccordion = (itemId: string) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  // Fonction de clic simple (sans animation)
  const handleButtonClick = (callback: () => void, element?: HTMLElement) => {
    callback();
  };

  // Sauvegarder les messages
  const handleSaveMessages = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const result = await saveMessages(messages);
      
      if (result.success) {
        setMessage(result.message);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Mettre à jour un message
  const updateMessage = async (index: number, field: keyof Message, value: string) => {
    const updatedMessages = [...messages];
    if (field === 'link') {
      const linkField = (value.includes('|') ? value.split('|')[0] : 'label') as 'label' | 'href';
      const linkValue = value.includes('|') ? value.split('|')[1] : value;
      
      if (!updatedMessages[index].link) {
        updatedMessages[index].link = { label: '', href: '' };
      }
      updatedMessages[index].link![linkField] = linkValue;
    } else {
      (updatedMessages[index] as any)[field] = value;
    }
    setMessages(updatedMessages);
    
    // Sauvegarder automatiquement
    try {
      setSaving(true);
      const result = await saveMessages(updatedMessages);
      if (result.success) {
        setMessage('Modification sauvegardée !');
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage('Erreur lors de la sauvegarde');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('Erreur lors de la sauvegarde');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Ajouter un nouveau message
  const addMessage = () => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      description: '',
      image: '',
      link: { label: '', href: '' },
      date: new Date().toISOString().split('T')[0]
    };
    setMessages([...messages, newMessage]);
    setExpandedItem(`message-${messages.length}`);
  };

  // Supprimer un message
  const removeMessage = async (index: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      const updatedMessages = messages.filter((_, i) => i !== index);
      setMessages(updatedMessages);
      setExpandedItem(null);
      
      // Sauvegarder automatiquement après suppression
      try {
        await saveMessages(updatedMessages);
        setMessage('Message supprimé avec succès');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        setMessage('Erreur lors de la suppression');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  // Réinitialiser les messages
  const resetMessages = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser les messages à leur état original ?')) {
      try {
        setLoading(true);
        localStorage.removeItem('admin_messages_backup');
        const data = await loadMessages();
        setMessages(data);
        setExpandedItem(null);
        setMessage('Messages réinitialisés à leur état original');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        setMessage('Erreur lors de la réinitialisation');
      } finally {
        setLoading(false);
      }
    }
  };

  // Sauvegarder les événements
  const handleSaveEvents = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const result = await saveEvents(events);
      
      if (result.success) {
        setMessage(result.message);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des événements:', error);
      setMessage('Erreur lors de la sauvegarde des événements');
    } finally {
      setSaving(false);
    }
  };

  // Mettre à jour un événement
  const updateEvent = (index: number, field: keyof Event, value: string) => {
    const updatedEvents = [...events];
    (updatedEvents[index] as any)[field] = value;
    setEvents(updatedEvents);
  };

  // Ajouter un nouvel événement
  const addEvent = () => {
    const newEvent: Event = {
      date: new Date().toISOString().split('T')[0],
      title: '',
      url: '',
      location: '',
      color: '#ff6d9e',
      image: ''
    };
    setEvents([...events, newEvent]);
    setExpandedItem(`event-${events.length}`);
  };

  // Supprimer un événement
  const removeEvent = async (index: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
      const updatedEvents = events.filter((_, i) => i !== index);
      setEvents(updatedEvents);
      setExpandedItem(null);
      
      // Sauvegarder automatiquement après suppression
      try {
        await saveEvents(updatedEvents);
        setMessage('Événement supprimé avec succès');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        setMessage('Erreur lors de la suppression');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  // Réinitialiser les événements
  const resetEvents = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser les événements à leur état original ?')) {
      try {
        setLoading(true);
        localStorage.removeItem('admin_events_backup');
        const data = await loadEvents();
        setEvents(data);
        setExpandedItem(null);
        setMessage('Événements réinitialisés à leur état original');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Erreur lors de la réinitialisation des événements:', error);
        setMessage('Erreur lors de la réinitialisation des événements');
      } finally {
        setLoading(false);
      }
    }
  };

  // ========== FONCTIONS MERCHANDISING ==========
  
  // Sauvegarder le merchandising
  const handleSaveMerchItems = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const result = await saveMerchItems(merchItems);
      
      if (result.success) {
        setMessage(result.message);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du merchandising:', error);
      setMessage('Erreur lors de la sauvegarde du merchandising');
    } finally {
      setSaving(false);
    }
  };

  // Mettre à jour un article de merchandising
  const updateMerchItem = async (index: number, field: keyof MerchItem, value: string | boolean) => {
    const updatedMerchItems = [...merchItems];
    (updatedMerchItems[index] as any)[field] = value;
    setMerchItems(updatedMerchItems);
    
    // Sauvegarder automatiquement
    try {
      setSaving(true);
      const result = await saveMerchItems(updatedMerchItems);
      if (result.success) {
        setMessage('Modification sauvegardée !');
        setTimeout(() => setMessage(''), 2000);
        
        // Déclencher un événement personnalisé pour notifier le Store
        const event = new CustomEvent('merchItemsUpdated', {
          detail: { key: 'merchItems', data: updatedMerchItems }
        });
        window.dispatchEvent(event);
      } else {
        setMessage('Erreur lors de la sauvegarde');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('Erreur lors de la sauvegarde');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Ajouter un nouvel article de merchandising
  const addMerchItem = () => {
    const newId = Math.max(...merchItems.map(item => item.id), 0) + 1;
    const newMerchItem: MerchItem = {
      id: newId,
      src: '',
      alt: '',
      caption: '',
      price: '',
      category: '',
      active: true,
      soldOut: false,
      sizes: {
        S: true,
        M: true,
        L: true,
        XL: true
      }
    };
    setMerchItems([...merchItems, newMerchItem]);
    setExpandedItem(`merch-${merchItems.length}`);
  };

  // Supprimer un article de merchandising
  const removeMerchItem = async (index: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
      const updatedMerchItems = merchItems.filter((_, i) => i !== index);
      setMerchItems(updatedMerchItems);
      setExpandedItem(null);
      
      // Sauvegarder automatiquement après suppression
      try {
        await saveMerchItems(updatedMerchItems);
        setMessage('Article supprimé avec succès');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        setMessage('Erreur lors de la suppression');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  // Réinitialiser le merchandising
  const resetMerchItems = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser le merchandising à son état original ?')) {
      try {
        setLoading(true);
        localStorage.removeItem('admin_merch_backup');
        const data = await loadMerchItems();
        setMerchItems(data);
        setExpandedItem(null);
        setMessage('Merchandising réinitialisé à son état original');
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Erreur lors de la réinitialisation du merchandising:', error);
        setMessage('Erreur lors de la réinitialisation du merchandising');
      } finally {
        setLoading(false);
      }
    }
  };

  // Sauvegarder la bio
  const handleSaveBio = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      localStorage.setItem('admin_bio_backup', JSON.stringify(bio));
      setMessage('Bio sauvegardée avec succès !');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la bio:', error);
      setMessage('Erreur lors de la sauvegarde de la bio');
    } finally {
      setSaving(false);
    }
  };

  // Mettre à jour la bio
  const updateBio = (field: keyof Bio, value: string) => {
    setBio(prev => ({ ...prev, [field]: value }));
  };



  // Fonction pour convertir les couleurs en format hexadécimal
  const convertToHex = (color: string): string => {
    // Si c'est déjà en hexadécimal, le retourner
    if (color.startsWith('#')) {
      return color;
    }
    
    // Si c'est en RGB, le convertir
    if (color.startsWith('rgb')) {
      const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    
    // Si c'est en RGBA, le convertir
    if (color.startsWith('rgba')) {
      const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    
    // Si c'est un nom de couleur CSS, essayer de le convertir
    const tempDiv = document.createElement('div');
    tempDiv.style.color = color;
    document.body.appendChild(tempDiv);
    const computedColor = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    
    if (computedColor.startsWith('rgb')) {
      const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    
    // Par défaut, retourner la couleur originale
    return color;
  };

  // Gérer les images uploadées
  const manageUploadedImages = () => {
    const uploadedImages = JSON.parse(localStorage.getItem('admin_uploaded_images') || '[]');
    
    if (uploadedImages.length === 0) {
      alert('Aucune image uploadée trouvée.');
      return;
    }

    let message = `Images uploadées (${uploadedImages.length}):\n\n`;
    uploadedImages.forEach((img: any, index: number) => {
      message += `${index + 1}. ${img.originalName} (${new Date(img.uploadedAt).toLocaleDateString()})\n`;
    });
    message += '\nVoulez-vous supprimer toutes les images uploadées ?';
    
    if (window.confirm(message)) {
      localStorage.removeItem('admin_uploaded_images');
      alert('Images uploadées supprimées.');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header - maintenant vide pour plus d'espace */}
      <div className="admin-header" style={{ display: 'none' }}>
      </div>

      {/* Message de statut */}
      {message && (
        <div className={`admin-message ${message.includes('Erreur') ? 'error' : 'success'}`}>
          <div className="admin-container">
            {message}
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="admin-content">
        <div className="admin-container">
          <div className="admin-layout">
            <aside className="admin-sidebar" data-active={activeTab}>
              <h1 className="admin-title">
                ADMINISTRATION<sup className="admin-subtitle">CMS</sup>
              </h1>
              
              <div className="sidebar-nav">
                {[
                  { key: 'messages', label: 'Messages', icon: 'fa-solid fa-envelope' },
                  { key: 'events', label: 'Événements', icon: 'fa-solid fa-calendar-days' },
                  { key: 'store', label: 'Store', icon: 'fa-solid fa-shopping-bag' },
                  { key: 'bio', label: 'Bio', icon: 'fa-solid fa-user' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`sidebar-tab ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={(e) => {
                      handleButtonClick(() => {
                        setActiveTab(tab.key as any);
                        setExpandedItem(null);
                      }, e.currentTarget);
                    }}
                  >
                    <span className="tab-label">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="sidebar-actions">
                {activeTab === 'messages' && (
                  <>
                    <button
                      onClick={(e) => handleButtonClick(addMessage, e.currentTarget)}
                      className="admin-btn primary small"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
                        <path d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z"/>
                      </svg> Ajouter
                    </button>
                    
                    
                  </>
                )}

                {activeTab === 'events' && (
                  <>
                    <button
                      onClick={(e) => handleButtonClick(addEvent, e.currentTarget)}
                      className="admin-btn primary small"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
                        <path d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z"/>
                      </svg> Ajouter
                    </button>
                    
                    
                  </>
                )}

                {activeTab === 'store' && (
                  <>
                    <button
                      onClick={(e) => handleButtonClick(addMerchItem, e.currentTarget)}
                      className="admin-btn primary small"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
                        <path d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z"/>
                      </svg> Ajouter
                    </button>
                    
                    
                  </>
                )}


                
                
              </div>
            </aside>
            <main className="admin-main">
              {/* Contenu des onglets */}
              <div className="admin-tab-content">
                
                {/* Messages */}
                {activeTab === 'messages' && (
                  <div className="admin-items">
                    {messages.length === 0 ? (
                      <div className="admin-empty-state">
📥
                        <h3>Aucun message</h3>
                        <p>Cliquez sur "Ajouter un message" pour commencer.</p>
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={messages.map(msg => msg.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {messages.map((msg, index) => {
                            const itemId = `message-${index}`;
                            const isExpanded = expandedItem === itemId;
                            
                            return (
                              <SortableMessage
                                key={msg.id}
                                message={msg}
                                index={index}
                                onEdit={(id) => {
                                  const msgIndex = messages.findIndex(m => m.id === id);
                                  if (msgIndex !== -1) {
                                    const itemId = `message-${msgIndex}`;
                                    toggleAccordion(itemId);
                                  }
                                }}
                                onDelete={(id) => {
                                  const msgIndex = messages.findIndex(m => m.id === id);
                                  if (msgIndex !== -1) {
                                    removeMessage(msgIndex);
                                  }
                                }}
                                onToggleExpand={(id) => {
                                  const msgIndex = messages.findIndex(m => m.id === id);
                                  if (msgIndex !== -1) {
                                    const itemId = `message-${msgIndex}`;
                                    toggleAccordion(itemId);
                                  }
                                }}
                                onUpdate={(index, field, value) => {
                                  updateMessage(index, field, value);
                                }}
                                onSave={handleSaveMessages}
                                saving={saving}
                                isExpanded={isExpanded}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                )}

                {/* Événements */}
                {activeTab === 'events' && (
                  <div className="admin-items">
                    {events.length === 0 ? (
                      <div className="admin-empty-state">
📅
                        <h3>Aucun événement</h3>
                        <p>Cliquez sur "Ajouter un événement" pour commencer.</p>
                      </div>
                    ) : (
                      events.map((event, index) => {
                        const itemId = `event-${index}`;
                        const isExpanded = expandedItem === itemId;
                        
                        return (
                          <div key={index} className="admin-accordion-item">
                            <div 
                              className="admin-accordion-header"
                              onClick={() => toggleAccordion(itemId)}
                            >
                              <div className="accordion-info">
                                <h3 className="accordion-title">
                                  Événement {index + 1}
                                  {event.title && <span className="title-preview">: {event.title}</span>}
                                </h3>
                                <div className="accordion-meta">
                                  <span className="meta-date">{event.date}</span>
                                  {event.location && (
                                    <span className="meta-location">
                                      📍 {event.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="accordion-actions">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleButtonClick(() => removeEvent(index), e.currentTarget);
                                  }}
                                  className="admin-btn danger small admin-btn-custom"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-delete">
                                    <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/>
                                  </svg>
                                </button>
                                
                                <button className="admin-btn secondary small admin-btn-custom">
                                  {isExpanded ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
                                    <path d="M297.4 105.4C309.9 92.9 330.2 92.9 342.7 105.4L502.7 265.4C511.9 274.6 514.6 288.3 509.6 300.3C504.6 312.3 492.9 320 480 320L384 320L384 496C384 522.5 362.5 544 336 544L304 544C277.5 544 256 522.5 256 496L256 320L160 320C147.1 320 135.4 312.2 130.4 300.2C125.4 288.2 128.2 274.5 137.4 265.4L297.4 105.4z"/>
                                  </svg> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-open">
                                    <path d="M88 289.6L64.4 360.2L64.4 160C64.4 124.7 93.1 96 128.4 96L267.1 96C280.9 96 294.4 100.5 305.5 108.8L343.9 137.6C349.4 141.8 356.2 144 363.1 144L480.4 144C515.7 144 544.4 172.7 544.4 208L544.4 224L179 224C137.7 224 101 250.4 87.9 289.6zM509.8 512L131 512C98.2 512 75.1 479.9 85.5 448.8L133.5 304.8C140 285.2 158.4 272 179 272L557.8 272C590.6 272 613.7 304.1 603.3 335.2L555.3 479.2C548.8 498.8 530.4 512 509.8 512z"/>
                                  </svg>}
                                </button>
                              </div>
                            </div>

                            <div className={`admin-accordion-content ${isExpanded ? 'expanded' : ''}`}>
                              <div className="accordion-form">
                                <div className="form-row">
                                  <div className="form-group">
                                    <label>Titre</label>
                                    <input
                                      type="text"
                                      value={event.title}
                                      onChange={(e) => updateEvent(index, 'title', e.target.value)}
                                      placeholder="Titre de l'événement"
                                    />
                                  </div>
                                </div>

                                <div className="form-row two-cols">
                                  <div className="form-group">
                                    <label>Date</label>
                                    <input
                                      type="date"
                                      value={event.date}
                                      onChange={(e) => updateEvent(index, 'date', e.target.value)}
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Lieu</label>
                                    <input
                                      type="text"
                                      value={event.location}
                                      onChange={(e) => updateEvent(index, 'location', e.target.value)}
                                      placeholder="Lieu de l'événement"
                                    />
                                  </div>
                                </div>

                                <div className="form-row">
                                  <div className="form-group">
                                    <label>URL</label>
                                    <input
                                      type="url"
                                      value={event.url}
                                      onChange={(e) => updateEvent(index, 'url', e.target.value)}
                                      placeholder="ex: https://www.facebook.com/events/..."
                                    />
                                  </div>
                                </div>

                                <div className="form-row two-cols">
                                  <div className="form-group">
                                    <label>Couleur</label>
                                    <div className="color-input-wrapper">
                                      <input
                                        type="color"
                                        value={event.color}
                                        onChange={(e) => updateEvent(index, 'color', e.target.value)}
                                      />
                                      <span className="color-value">{event.color}</span>
                                    </div>
                                  </div>
                                  <div className="form-group">
                                    <ImageUpload
                                      value={event.image}
                                      onChange={(value) => updateEvent(index, 'image', value)}
                                      placeholder="ex: events/lancement.webp"
                                      useButton={true}
                                    />
                                  </div>
                                </div>
                                
                                {/* Bouton Save individuel */}
                                <div className="form-row" style={{ marginTop: '15px', textAlign: 'right' }}>
                                  <button 
                                    onClick={(e) => handleButtonClick(handleSaveMessages, e.currentTarget)}
                                    disabled={saving}
                                    className="admin-btn success small admin-btn-custom"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-save">
                                      <path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 237.3C544 220.3 537.3 204 525.3 192L448 114.7C436 102.7 419.7 96 402.7 96L160 96zM192 192C192 174.3 206.3 160 224 160L384 160C401.7 160 416 174.3 416 192L416 256C416 273.7 401.7 288 384 288L224 288C206.3 288 192 273.7 192 256L192 192zM320 352C355.3 352 384 380.7 384 416C384 451.3 355.3 480 320 480C284.7 480 256 451.3 256 416C256 380.7 284.7 352 320 352z"/>
                                    </svg>
                                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Store / Merchandising */}
                {activeTab === 'store' && (
                  <div className="admin-items">
                    {merchItems.length === 0 ? (
                      <div className="admin-empty-state">
                        🛍️
                        <h3>Aucun article</h3>
                        <p>Commencez par ajouter votre premier article de merchandising</p>
                      </div>
                    ) : (
                      (() => {
                        // Grouper les articles par catégorie
                        const groupedItems = merchItems.reduce((acc, item, index) => {
                          if (!acc[item.category]) {
                            acc[item.category] = [];
                          }
                          acc[item.category].push({ ...item, originalIndex: index });
                          return acc;
                        }, {} as Record<string, Array<MerchItem & { originalIndex: number }>>);

                        return Object.entries(groupedItems).map(([category, items]) => {
                          const categoryId = `category-${category}`;
                          const isExpanded = expandedItem === categoryId;
                          const firstItem = items[0];
                          const categoryNames: Record<string, string> = {
                            'sweatshirt': 'Sweatshirt',
                            'hoodie': 'Hoodie',
                            'tshirt': 'T-shirt',
                            'bag': 'Hip Bag',
                            'other': 'Autre'
                          };

                          return (
                            <div key={categoryId} className="admin-accordion-item">
                              <div 
                                className="admin-accordion-header"
                                onClick={() => toggleAccordion(categoryId)}
                              >
                                <div className="accordion-info">
                                  <h3 className="accordion-title">
                                    {categoryNames[category] || category} ({items.length} variante{items.length > 1 ? 's' : ''})
                                  </h3>
                                  <div className="accordion-meta">
                                    <span className="meta-category">{firstItem.category}</span>
                                    <span className="meta-price">{firstItem.price}</span>
                                    <span className={`meta-status ${firstItem.active ? 'active' : 'inactive'}`}>
                                      {firstItem.active ? 'Actif' : 'Inactif'}
                                    </span>
                                  </div>
                                </div>
                                <div className="accordion-actions">
                                  <button className="admin-btn secondary small admin-btn-custom">
                                    {isExpanded ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
                                      <path d="M297.4 105.4C309.9 92.9 330.2 92.9 342.7 105.4L502.7 265.4C511.9 274.6 514.6 288.3 509.6 300.3C504.6 312.3 492.9 320 480 320L384 320L384 496C384 522.5 362.5 544 336 544L304 544C277.5 544 256 522.5 256 496L256 320L160 320C147.1 320 135.4 312.2 130.4 300.2C125.4 288.2 128.2 274.5 137.4 265.4L297.4 105.4z"/>
                                    </svg> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-open">
                                      <path d="M88 289.6L64.4 360.2L64.4 160C64.4 124.7 93.1 96 128.4 96L267.1 96C280.9 96 294.4 100.5 305.5 108.8L343.9 137.6C349.4 141.8 356.2 144 363.1 144L480.4 144C515.7 144 544.4 172.7 544.4 208L544.4 224L179 224C137.7 224 101 250.4 87.9 289.6zM509.8 512L131 512C98.2 512 75.1 479.9 85.5 448.8L133.5 304.8C140 285.2 158.4 272 179 272L557.8 272C590.6 272 613.7 304.1 603.3 335.2L555.3 479.2C548.8 498.8 530.4 512 509.8 512z"/>
                                    </svg>}
                                  </button>
                                </div>
                              </div>
                              
                              <div className={`admin-accordion-content ${isExpanded ? 'expanded' : ''}`}>
                                <div className="admin-form-grid">
                                  {category !== 'bag' && (
                                    <div className="form-group">
                                      <label>Catégorie</label>
                                      <select
                                        value={firstItem.category}
                                        onChange={async (e) => {
                                          for (const item of items) {
                                            await updateMerchItem(item.originalIndex, 'category', e.target.value);
                                          }
                                        }}
                                        className="admin-select"
                                      >
                                        <option value="sweatshirt">Sweatshirt</option>
                                        <option value="hoodie">Hoodie</option>
                                        <option value="tshirt">T-shirt</option>
                                        <option value="bag">Hip Bag</option>
                                        <option value="other">Autre</option>
                                      </select>
                                    </div>
                                  )}
                                  
                                  <div className="form-group">
                                    <label>Prix (pour tous les articles de cette catégorie)</label>
                                    <input
                                      type="text"
                                      value={firstItem.price}
                                      onChange={async (e) => {
                                        for (const item of items) {
                                          await updateMerchItem(item.originalIndex, 'price', e.target.value);
                                        }
                                      }}
                                      placeholder="ex: 50$ CAD"
                                    />
                                  </div>
                                  
                                  <div className="form-group">
                                    <label className="checkbox-label">
                                      <input
                                        type="checkbox"
                                        checked={firstItem.active}
                                        onChange={async (e) => {
                                          for (const item of items) {
                                            await updateMerchItem(item.originalIndex, 'active', e.target.checked);
                                          }
                                        }}
                                      />
                                      <span className="checkmark"></span>
                                      Tous les articles actifs (visibles sur le site)
                                    </label>
                                  </div>
                                  
                                  <div className="form-group full-width">
                                    {category !== 'bag' && <label>Images ({items.length} variante{items.length > 1 ? 's' : ''})</label>}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: category !== 'bag' ? '0.5rem' : '0' }}>
                                      {items.map((item, itemIndex) => (
                                        <div key={item.originalIndex} style={{ border: '1px solid #404040', borderRadius: '8px', padding: '1rem' }}>
                                          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                            {item.caption}
                                          </div>
                                          <ImageUpload
                                            value={item.src}
                                            onChange={async (value) => await updateMerchItem(item.originalIndex, 'src', value)}
                                            placeholder="ex: images/Merch_Tshirt-Front.webp"
                                            useButton={true}
                                          />
                                          <div style={{ marginTop: '0.5rem' }}>
                                            <input
                                              type="text"
                                              value={item.caption}
                                              onChange={async (e) => await updateMerchItem(item.originalIndex, 'caption', e.target.value)}
                                              placeholder={category === 'bag' ? 'Hip Bag' : 'Nom affiché sous l\'image'}
                                              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #404040', background: '#2a2a2a', color: '#ffffff' }}
                                            />
                                          </div>
                                          
                                          {/* Checkbox SOLD OUT */}
                                          <div style={{ marginTop: '0.5rem' }}>
                                            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <input
                                                type="checkbox"
                                                checked={item.soldOut}
                                                onChange={async (e) => await updateMerchItem(item.originalIndex, 'soldOut', e.target.checked)}
                                              />
                                              <span className="checkmark"></span>
                                              <span style={{ color: '#ffffff', fontWeight: 'bold' }}>SOLD OUT</span>
                                            </label>
                                          </div>
                                          
                                          {/* Tailles disponibles (pas pour les hip bags) */}
                                          {!item.alt.toLowerCase().includes('bag') && (
                                            <div style={{ marginTop: '1rem' }}>
                                              <label style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                                                Tailles disponibles :
                                              </label>
                                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                {['S', 'M', 'L', 'XL'].map(size => (
                                                  <label key={size} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <input
                                                      type="checkbox"
                                                      checked={item.sizes?.[size as keyof typeof item.sizes] || false}
                                                      onChange={async (e) => {
                                                        const updatedSizes = {
                                                          ...item.sizes,
                                                          [size]: e.target.checked
                                                        };
                                                        await updateMerchItem(item.originalIndex, 'sizes', updatedSizes);
                                                      }}
                                                    />
                                                    <span className="checkmark"></span>
                                                    <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{size}</span>
                                                  </label>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          <button
                                            onClick={() => removeMerchItem(item.originalIndex)}
                                            className="admin-btn variant-delete small"
                                            style={{ marginTop: '0.5rem', width: '100%' }}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
                                              <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z"/>
                                            </svg>
                                            Supprimer cette variante
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Bouton Save individuel */}
                                  <div className="form-row" style={{ marginTop: '15px', textAlign: 'right' }}>
                                    <button 
                                      onClick={(e) => handleButtonClick(handleSaveMessages, e.currentTarget)}
                                      disabled={saving}
                                      className="admin-btn success small admin-btn-custom"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-save">
                                        <path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 237.3C544 220.3 537.3 204 525.3 192L448 114.7C436 102.7 419.7 96 402.7 96L160 96zM192 192C192 174.3 206.3 160 224 160L384 160C401.7 160 416 174.3 416 192L416 256C416 273.7 401.7 288 384 288L224 288C206.3 288 192 273.7 192 256L192 192zM320 352C355.3 352 384 380.7 384 416C384 451.3 355.3 480 320 480C284.7 480 256 451.3 256 416C256 380.7 284.7 352 320 352z"/>
                                      </svg>
                                      {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                )}

                {/* Bio */}
                {activeTab === 'bio' && (
                  <div className="admin-items">
                    <div className="admin-accordion-item">
                      <div 
                        className="admin-accordion-header"
                        onClick={() => toggleAccordion('bio')}
                      >
                        <div className="accordion-info">
                          <h3 className="accordion-title">Biographie de l'artiste</h3>
                          <div className="accordion-meta">
                            <span className="meta-length">
                              {bio.text.length} caractères
                            </span>
                            {bio.text && (
                              <span className="meta-description">
                                {bio.text.substring(0, 80)}...
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="accordion-actions">
                          <button className="admin-btn secondary small admin-btn-custom">
                            {expandedItem === 'bio' ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon">
                              <path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/>
                            </svg> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="admin-icon admin-icon-open">
                              <path d="M88 289.6L64.4 360.2L64.4 160C64.4 124.7 93.1 96 128.4 96L267.1 96C280.9 96 294.4 100.5 305.5 108.8L343.9 137.6C349.4 141.8 356.2 144 363.1 144L480.4 144C515.7 144 544.4 172.7 544.4 208L544.4 224L179 224C137.7 224 101 250.4 87.9 289.6zM509.8 512L131 512C98.2 512 75.1 479.9 85.5 448.8L133.5 304.8C140 285.2 158.4 272 179 272L557.8 272C590.6 272 613.7 304.1 603.3 335.2L555.3 479.2C548.8 498.8 530.4 512 509.8 512z"/>
                            </svg>}
                          </button>
                        </div>
                      </div>

                      <div className={`admin-accordion-content ${expandedItem === 'bio' ? 'expanded' : ''}`}>
                        <div className="accordion-form">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Texte de la bio</label>
                              <textarea
                                value={bio.text}
                                onChange={(e) => updateBio('text', e.target.value)}
                                rows={10}
                                placeholder="Écrivez votre bio ici..."
                              />
                              <small className="form-help">
                                Cette bio apparaîtra sur la page principale de votre site.
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;