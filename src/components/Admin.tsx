import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Message, loadMessages, saveMessages } from '../utils/adminApi';
import ImageUpload from './ImageUpload';

interface Event {
  date: string;
  title: string;
  url: string;
  location: string;
  color: string;
  image: string;
}

interface Bio {
  text: string;
}

interface BackgroundSettings {
  defaultImage: string;
  useBackground: boolean;
  backgroundType: 'image' | 'gradient';
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: string;
}

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'messages' | 'events' | 'bio' | 'background'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [bio, setBio] = useState<Bio>({ text: '' });
  const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>({ 
    defaultImage: 'images/mixtape37.webp',
    useBackground: true,
    backgroundType: 'image',
    gradientColor1: '#1a1a2e',
    gradientColor2: '#16213e',
    gradientDirection: '135deg'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Refs pour les animations GSAP
  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Animation d'entrée de la page
  useEffect(() => {
    if (!loading && pageRef.current) {
      const tl = gsap.timeline();
      
      tl.fromTo(headerRef.current, 
        { y: -50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      )
      .fromTo(tabsRef.current?.children || [], 
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: "power2.out" },
        "-=0.3"
      )
      .fromTo(contentRef.current, 
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
        "-=0.2"
      );
    }
  }, [loading]);

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
        const eventsResponse = await fetch('/events.json');
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setEvents(eventsData);
        }
        
        // Charger la bio depuis localStorage ou valeur par défaut
        const savedBio = localStorage.getItem('admin_bio_backup');
        if (savedBio) {
          setBio(JSON.parse(savedBio));
        } else {
          setBio({ 
            text: "Maudite Machine is a Canadian DJ and producer known for his raw, hypnotic approach to minimal and indie dance. Born from the Montreal underground, he has performed at major events including Piknic Électronik, Eclipse Festival, and the iconic Techno Parade in Paris, delivering sets that blur the line between intensity and atmosphere across Canada and Europe.\n\nAs the founder of VRSTL Records, he curates a sound that embraces tension, groove, and experimentation, having shared the stage with electronic music legends like Carl Craig, Ellen Allien, The Hacker, Popof, and Agoria. His collaborations with influential artists reflect a constant drive to push boundaries and redefine the underground with a distinct sonic signature, championing bold artists who share his vision for the darker, experimental sides of electronic music." 
          });
        }

        // Charger les paramètres de background depuis localStorage
        const savedBackground = localStorage.getItem('admin_background_settings');
        if (savedBackground) {
          const backgroundData = JSON.parse(savedBackground);
          console.log('🔄 Admin - Chargement background data:', backgroundData);
          
          // Assurer la rétrocompatibilité avec les nouvelles propriétés
          const completeSettings: BackgroundSettings = {
            defaultImage: backgroundData.defaultImage || 'images/mixtape37.webp',
            useBackground: backgroundData.useBackground !== false,
            backgroundType: backgroundData.backgroundType || 'image',
            gradientColor1: backgroundData.gradientColor1 || '#1a1a2e',
            gradientColor2: backgroundData.gradientColor2 || '#16213e',
            gradientDirection: backgroundData.gradientDirection || '135deg'
          };
          
          console.log('✅ Admin - Settings complets:', completeSettings);
          setBackgroundSettings(completeSettings);
        } else {
          // Valeurs par défaut si aucune sauvegarde
          setBackgroundSettings({
            defaultImage: 'images/mixtape37.webp',
            useBackground: true,
            backgroundType: 'image',
            gradientColor1: '#1a1a2e',
            gradientColor2: '#16213e',
            gradientDirection: '135deg'
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

  // Fonctions d'animation
  const animateButton = (element: HTMLElement) => {
    gsap.to(element, {
      scale: 0.95,
      duration: 0.1,
      ease: "power2.out",
      yoyo: true,
      repeat: 1
    });
  };

  const handleButtonClick = (callback: () => void, element: HTMLElement) => {
    animateButton(element);
    setTimeout(callback, 100);
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
  const updateMessage = (index: number, field: keyof Message, value: string) => {
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
  };

  // Ajouter un nouveau message
  const addMessage = () => {
    const newMessage: Message = {
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
  const removeMessage = (index: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      const updatedMessages = messages.filter((_, i) => i !== index);
      setMessages(updatedMessages);
      setExpandedItem(null);
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
      localStorage.setItem('admin_events_backup', JSON.stringify(events));
      setMessage('Événements sauvegardés avec succès !');
      setTimeout(() => setMessage(''), 3000);
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
  const removeEvent = (index: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
      const updatedEvents = events.filter((_, i) => i !== index);
      setEvents(updatedEvents);
      setExpandedItem(null);
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

  // Sauvegarder les paramètres de background
  const handleSaveBackground = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      console.log('💾 Sauvegarde background:', backgroundSettings);
      console.log('🎨 Type de background:', backgroundSettings.backgroundType);
      console.log('🌈 Gradient colors:', backgroundSettings.gradientColor1, backgroundSettings.gradientColor2);
      console.log('📐 Gradient direction:', backgroundSettings.gradientDirection);
      
      localStorage.setItem('admin_background_settings', JSON.stringify(backgroundSettings));
      
      // Déclencher un événement pour notifier MainApp du changement
      window.dispatchEvent(new CustomEvent('admin_background_updated'));
      
      setMessage(`Paramètres sauvegardés ! Background ${backgroundSettings.useBackground ? 'activé' : 'désactivé'} (${backgroundSettings.backgroundType})`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du background:', error);
      setMessage('Erreur lors de la sauvegarde du background');
    } finally {
      setSaving(false);
    }
  };

  // Mettre à jour les paramètres de background
  const updateBackground = (field: keyof BackgroundSettings, value: string | boolean) => {
    console.log(`🔧 Mise à jour ${field}:`, value);
    const newSettings = { ...backgroundSettings, [field]: value };
    console.log('📝 Nouveaux paramètres:', newSettings);
    setBackgroundSettings(newSettings);
    
    // Si c'est un changement de type, sauvegarder automatiquement
    if (field === 'backgroundType') {
      console.log('🎨 Changement de type détecté, sauvegarde automatique...');
      setTimeout(() => {
        localStorage.setItem('admin_background_settings', JSON.stringify(newSettings));
        window.dispatchEvent(new CustomEvent('admin_background_updated'));
        console.log('✅ Sauvegarde automatique terminée');
      }, 100);
    }
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
    <div className="admin-page" ref={pageRef}>
      {/* Header - maintenant vide pour plus d'espace */}
      <div className="admin-header" ref={headerRef} style={{ display: 'none' }}>
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
      <div className="admin-content" ref={contentRef}>
        <div className="admin-container">
          <div className="admin-layout">
            <aside className="admin-sidebar" ref={tabsRef}>
              <h1 className="admin-title">
                ADMINISTRATION<sup className="admin-subtitle">CMS</sup>
              </h1>
              
              <div className="sidebar-nav" data-active={activeTab}>
                {[
                  { key: 'messages', label: 'Messages', icon: '✉' },
                  { key: 'events', label: 'Événements', icon: '📅' },
                  { key: 'bio', label: 'Bio', icon: '👤' },
                  { key: 'background', label: 'Background', icon: '🖼' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={(e) => {
                      handleButtonClick(() => {
                        setActiveTab(tab.key as any);
                        setExpandedItem(null);
                      }, e.currentTarget);
                    }}
                  >
                    <span className="tab-icon">{tab.icon}</span>
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
                      + Ajouter
                    </button>
                    
                    <button
                      onClick={(e) => handleButtonClick(handleSaveMessages, e.currentTarget)}
                      disabled={saving}
                      className="admin-btn success small"
                    >
                      💾 {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                    
                    <button
                      onClick={(e) => handleButtonClick(resetMessages, e.currentTarget)}
                      className="admin-btn secondary small"
                    >
                      ↻ Réinitialiser
                    </button>
                  </>
                )}

                {activeTab === 'events' && (
                  <>
                    <button
                      onClick={(e) => handleButtonClick(addEvent, e.currentTarget)}
                      className="admin-btn primary small"
                    >
                      + Ajouter
                    </button>
                    
                    <button
                      onClick={(e) => handleButtonClick(handleSaveEvents, e.currentTarget)}
                      disabled={saving}
                      className="admin-btn success small"
                    >
                      💾 {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                  </>
                )}

                {activeTab === 'bio' && (
                  <button
                    onClick={(e) => handleButtonClick(handleSaveBio, e.currentTarget)}
                    disabled={saving}
                    className="admin-btn success small"
                  >
                    💾 {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                )}

                {activeTab === 'background' && (
                  <>
                    <button
                      onClick={(e) => handleButtonClick(handleSaveBackground, e.currentTarget)}
                      disabled={saving}
                      className="admin-btn success small"
                    >
                      💾 {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                    
                    <button
                      onClick={() => {
                        console.log('🧪 TEST GRADIENT FORCÉ');
                        const testSettings = {
                          defaultImage: 'images/mixtape37.webp',
                          useBackground: true,
                          backgroundType: 'gradient' as const,
                          gradientColor1: '#ff0000',
                          gradientColor2: '#0000ff',
                          gradientDirection: '45deg'
                        };
                        console.log('📝 Settings de test:', testSettings);
                        localStorage.setItem('admin_background_settings', JSON.stringify(testSettings));
                        window.dispatchEvent(new CustomEvent('admin_background_updated'));
                        setBackgroundSettings(testSettings);
                        console.log('✅ Test gradient appliqué!');
                      }}
                      className="admin-btn warning small"
                    >
                      🧪 TEST
                    </button>
                    <button
                      onClick={(e) => handleButtonClick(() => {
                        localStorage.removeItem('admin_background_settings');
                        setBackgroundSettings({
                          defaultImage: 'images/mixtape37.webp',
                          useBackground: true,
                          backgroundType: 'image',
                          gradientColor1: '#1a1a2e',
                          gradientColor2: '#16213e',
                          gradientDirection: '135deg'
                        });
                        window.dispatchEvent(new CustomEvent('admin_background_updated'));
                        setMessage('Paramètres de background réinitialisés !');
                        setTimeout(() => setMessage(''), 3000);
                      }, e.currentTarget)}
                      className="admin-btn danger small"
                    >
                      ↻ Réinitialiser
                    </button>
                  </>
                )}
                
                <button
                  onClick={(e) => handleButtonClick(manageUploadedImages, e.currentTarget)}
                  className="admin-btn info small"
                >
                  🖼 Gérer images
                </button>
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
                      messages.map((msg, index) => {
                        const itemId = `message-${index}`;
                        const isExpanded = expandedItem === itemId;
                        
                        return (
                          <div key={index} className="admin-accordion-item">
                            <div 
                              className="admin-accordion-header"
                              onClick={() => toggleAccordion(itemId)}
                            >
                              <div className="accordion-info">
                                <h3 className="accordion-title">
                                  Message {index + 1}
                                  {msg.title && <span className="title-preview">: {msg.title}</span>}
                                </h3>
                                <div className="accordion-meta">
                                  <span className="meta-date">{msg.date}</span>
                                  {msg.description && (
                                    <span className="meta-description">
                                      {msg.description.substring(0, 50)}...
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="accordion-actions">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleButtonClick(() => removeMessage(index), e.currentTarget);
                                  }}
                                  className="admin-btn danger small"
                                >
                                  🗑
                                </button>
                                
                                <div className={`accordion-toggle ${isExpanded ? 'expanded' : ''}`}>
                                  <div className="arrow"></div>
                                </div>
                              </div>
                            </div>

                            <div className={`admin-accordion-content ${isExpanded ? 'expanded' : ''}`}>
                              <div className="accordion-form">
                                <div className="form-row">
                                  <div className="form-group">
                                    <label>Titre</label>
                                    <input
                                      type="text"
                                      value={msg.title}
                                      onChange={(e) => updateMessage(index, 'title', e.target.value)}
                                      placeholder="Titre du message"
                                    />
                                  </div>
                                </div>

                                <div className="form-row">
                                  <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                      value={msg.description}
                                      onChange={(e) => updateMessage(index, 'description', e.target.value)}
                                      rows={3}
                                      placeholder="Description du message"
                                    />
                                  </div>
                                </div>

                                <div className="form-row">
                                  <ImageUpload
                                    value={msg.image}
                                    onChange={(value) => updateMessage(index, 'image', value)}
                                    placeholder="ex: images/Simetra.webp"
                                  />
                                </div>

                                <div className="form-row two-cols">
                                  <div className="form-group">
                                    <label>Label du lien</label>
                                    <input
                                      type="text"
                                      value={msg.link?.label || ''}
                                      onChange={(e) => updateMessage(index, 'link', `label|${e.target.value}`)}
                                      placeholder="ex: Soundcloud"
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>URL du lien</label>
                                    <input
                                      type="url"
                                      value={msg.link?.href || ''}
                                      onChange={(e) => updateMessage(index, 'link', `href|${e.target.value}`)}
                                      placeholder="ex: https://soundcloud.com/..."
                                    />
                                  </div>
                                </div>

                                <div className="form-row">
                                  <div className="form-group">
                                    <label>Date</label>
                                    <input
                                      type="date"
                                      value={msg.date}
                                      onChange={(e) => updateMessage(index, 'date', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
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
                                  className="admin-btn danger small"
                                >
                                  🗑
                                </button>
                                
                                <div className={`accordion-toggle ${isExpanded ? 'expanded' : ''}`}>
                                  <div className="arrow"></div>
                                </div>
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
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
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
                          <div className={`accordion-toggle ${expandedItem === 'bio' ? 'expanded' : ''}`}>
                            <div className="arrow"></div>
                          </div>
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

                {/* Background */}
                {activeTab === 'background' && (
                  <div className="admin-items">
                    <div className="admin-accordion-item">
                      <div 
                        className="admin-accordion-header"
                        onClick={() => toggleAccordion('background')}
                      >
                        <div className="accordion-info">
                          <h3 className="accordion-title">Paramètres du Background</h3>
                          <div className="accordion-meta">
                            <span className="meta-description">
                              Fond d'écran du site principal
                            </span>
                            <span className="meta-length">
                              {!backgroundSettings.useBackground ? 'Désactivé' : 
                               backgroundSettings.backgroundType === 'gradient' ? 'Dégradé actif' : 
                               backgroundSettings.defaultImage.startsWith('data:') ? 'Image uploadée' : 'Image par défaut'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="accordion-actions">
                          <div className={`accordion-toggle ${expandedItem === 'background' ? 'expanded' : ''}`}>
                            <div className="arrow"></div>
                          </div>
                        </div>
                      </div>

                      <div className={`admin-accordion-content ${expandedItem === 'background' ? 'expanded' : ''}`}>
                        <div className="accordion-form">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Utiliser un fond d'écran</label>
                              <div className="toggle-switch">
                                <input
                                  type="checkbox"
                                  id="useBackground"
                                  checked={backgroundSettings.useBackground}
                                  onChange={(e) => updateBackground('useBackground', e.target.checked)}
                                />
                                <label htmlFor="useBackground" className="toggle-label">
                                  <span className="toggle-slider"></span>
                                </label>
                                <span className="toggle-text">
                                  {backgroundSettings.useBackground ? 'Activé' : 'Désactivé'}
                                </span>
                              </div>
                              <small className="form-help">
                                Désactiver pour avoir un fond uni sans image.
                              </small>
                            </div>
                          </div>

                          {backgroundSettings.useBackground && (
                            <>
                              <div className="form-row">
                                <div className="form-group">
                                  <label>Type de fond</label>
                                  <select
                                    value={backgroundSettings.backgroundType}
                                    onChange={(e) => updateBackground('backgroundType', e.target.value as 'image' | 'gradient')}
                                    className="admin-select"
                                  >
                                    <option value="image">Image</option>
                                    <option value="gradient">Dégradé</option>
                                  </select>
                                  <small className="form-help">
                                    Choisir entre une image ou un dégradé de couleurs.
                                  </small>
                                </div>
                              </div>

                              {backgroundSettings.backgroundType === 'image' && (
                                <div className="form-row">
                                  <div className="form-group">
                                    <label>Image de fond par défaut</label>
                                    <ImageUpload
                                      value={backgroundSettings.defaultImage}
                                      onChange={(value) => updateBackground('defaultImage', value)}
                                      placeholder="ex: images/mon-background.webp"
                                    />
                                    <small className="form-help">
                                      Cette image sera utilisée comme fond par défaut du site. Les tracks de la playlist peuvent toujours changer le fond temporairement.
                                    </small>
                                  </div>
                                </div>
                              )}

                              {backgroundSettings.backgroundType === 'gradient' && (
                                <>
                                  <div className="form-row">
                                    <div className="form-group">
                                      <label>Couleur 1 du dégradé</label>
                                      <input
                                        type="color"
                                        value={backgroundSettings.gradientColor1}
                                        onChange={(e) => updateBackground('gradientColor1', e.target.value)}
                                        className="admin-color-picker"
                                      />
                                      <input
                                        type="text"
                                        value={backgroundSettings.gradientColor1}
                                        onChange={(e) => updateBackground('gradientColor1', e.target.value)}
                                        className="admin-input"
                                        placeholder="#1a1a2e"
                                      />
                                    </div>
                                  </div>

                                  <div className="form-row">
                                    <div className="form-group">
                                      <label>Couleur 2 du dégradé</label>
                                      <input
                                        type="color"
                                        value={backgroundSettings.gradientColor2}
                                        onChange={(e) => updateBackground('gradientColor2', e.target.value)}
                                        className="admin-color-picker"
                                      />
                                      <input
                                        type="text"
                                        value={backgroundSettings.gradientColor2}
                                        onChange={(e) => updateBackground('gradientColor2', e.target.value)}
                                        className="admin-input"
                                        placeholder="#16213e"
                                      />
                                    </div>
                                  </div>

                                  <div className="form-row">
                                    <div className="form-group">
                                      <label>Direction du dégradé</label>
                                      <select
                                        value={backgroundSettings.gradientDirection}
                                        onChange={(e) => updateBackground('gradientDirection', e.target.value)}
                                        className="admin-select"
                                      >
                                        <option value="0deg">Vertical (haut → bas)</option>
                                        <option value="90deg">Horizontal (gauche → droite)</option>
                                        <option value="45deg">Diagonal (↗)</option>
                                        <option value="135deg">Diagonal (↘)</option>
                                        <option value="180deg">Vertical (bas → haut)</option>
                                        <option value="270deg">Horizontal (droite → gauche)</option>
                                      </select>
                                    </div>
                                  </div>
                                </>
                              )}
                            </>
                          )}

                          {backgroundSettings.useBackground && (
                            <div className="form-row">
                              <div className="form-group">
                                <label>Aperçu</label>
                                <div className="background-preview">
                                  {backgroundSettings.backgroundType === 'image' && backgroundSettings.defaultImage && (
                                    <img 
                                      src={backgroundSettings.defaultImage.startsWith('data:') ? backgroundSettings.defaultImage : `/${backgroundSettings.defaultImage}`}
                                      alt="Aperçu du background"
                                      style={{
                                        width: '100%',
                                        maxWidth: '300px',
                                        height: '200px',
                                        objectFit: 'cover',
                                        borderRadius: '8px',
                                        border: '1px solid var(--admin-border)'
                                      }}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  {backgroundSettings.backgroundType === 'gradient' && (
                                    <div
                                      style={{
                                        width: '100%',
                                        maxWidth: '300px',
                                        height: '200px',
                                        background: `linear-gradient(${backgroundSettings.gradientDirection}, ${backgroundSettings.gradientColor1}, ${backgroundSettings.gradientColor2})`,
                                        borderRadius: '8px',
                                        border: '1px solid var(--admin-border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                      }}
                                    >
                                      Aperçu du dégradé
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
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