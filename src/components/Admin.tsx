import React, { useState, useEffect } from 'react';
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

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'messages' | 'events' | 'bio'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [bio, setBio] = useState<Bio>({ text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Charger les données depuis l'API
  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les messages
        const messagesData = await loadMessages();
        setMessages(messagesData);
        
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
          // Bio actuelle du site
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
      // Gérer les champs de lien séparément
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
  };

  // Supprimer un message
  const removeMessage = (index: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      const updatedMessages = messages.filter((_, i) => i !== index);
      setMessages(updatedMessages);
    }
  };

  // Réinitialiser les messages à leur état original
  const resetMessages = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser les messages à leur état original ? Toutes les modifications non sauvegardées seront perdues.')) {
      try {
        setLoading(true);
        // Supprimer le cache localStorage
        localStorage.removeItem('admin_messages_backup');
        // Recharger depuis le fichier JSON original
        const data = await loadMessages();
        setMessages(data);
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
      // Simuler une sauvegarde (dans un vrai projet, vous feriez un appel API)
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
  };

  // Supprimer un événement
  const removeEvent = (index: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
      const updatedEvents = events.filter((_, i) => i !== index);
      setEvents(updatedEvents);
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
        Chargement des données...
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Administration</h1>
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            Messages
          </button>
          <button
            className={`admin-tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Événements
          </button>
          <button
            className={`admin-tab ${activeTab === 'bio' ? 'active' : ''}`}
            onClick={() => setActiveTab('bio')}
          >
            Bio
          </button>
        </div>
      </div>

      {message && (
        <div className={`admin-message ${message.includes('Erreur') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="admin-controls">
        {activeTab === 'messages' ? (
          <>
            <button
              onClick={addMessage}
              className="admin-btn admin-btn-primary"
            >
              + Ajouter un message
            </button>
            
            <button
              onClick={handleSaveMessages}
              disabled={saving}
              className="admin-btn admin-btn-success"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            
            <button
              onClick={resetMessages}
              className="admin-btn"
              style={{ 
                background: 'linear-gradient(45deg, #6c757d, #5a6268)', 
                color: 'white',
                boxShadow: '0 4px 15px rgba(108, 117, 125, 0.3)'
              }}
            >
              Réinitialiser
            </button>
          </>
        ) : activeTab === 'events' ? (
          <>
            <button
              onClick={addEvent}
              className="admin-btn admin-btn-primary"
            >
              + Ajouter un événement
            </button>
            
            <button
              onClick={handleSaveEvents}
              disabled={saving}
              className="admin-btn admin-btn-success"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleSaveBio}
              disabled={saving}
              className="admin-btn admin-btn-success"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder la Bio'}
            </button>
          </>
        )}
        
        <button
          onClick={manageUploadedImages}
          className="admin-btn"
          style={{ 
            background: 'linear-gradient(45deg, #8b5cf6, #7c3aed)', 
            color: 'white',
            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
          }}
        >
          <i className="fa-solid fa-images" style={{ marginRight: '6px' }}></i>
          Images
        </button>
      </div>

      {activeTab === 'messages' ? (
        <div className="admin-messages-grid">
          {messages.map((msg, index) => (
            <div key={index} className="admin-message-card">
              <div className="admin-message-header">
                <h3 className="admin-message-title">Message {index + 1}</h3>
                <button
                  onClick={() => removeMessage(index)}
                  className="admin-btn admin-btn-danger"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  Supprimer
                </button>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Titre:
                </label>
                <input
                  type="text"
                  value={msg.title}
                  onChange={(e) => updateMessage(index, 'title', e.target.value)}
                  className="admin-form-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Description:
                </label>
                <textarea
                  value={msg.description}
                  onChange={(e) => updateMessage(index, 'description', e.target.value)}
                  rows={3}
                  className="admin-form-textarea"
                />
              </div>

              <ImageUpload
                value={msg.image}
                onChange={(value) => updateMessage(index, 'image', value)}
                placeholder="ex: images/Simetra.webp"
              />

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    Label du lien:
                  </label>
                  <input
                    type="text"
                    value={msg.link?.label || ''}
                    onChange={(e) => updateMessage(index, 'link', `label|${e.target.value}`)}
                    placeholder="ex: Soundcloud"
                    className="admin-form-input"
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    URL du lien:
                  </label>
                  <input
                    type="url"
                    value={msg.link?.href || ''}
                    onChange={(e) => updateMessage(index, 'link', `href|${e.target.value}`)}
                    placeholder="ex: https://soundcloud.com/..."
                    className="admin-form-input"
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Date:
                </label>
                <input
                  type="date"
                  value={msg.date}
                  onChange={(e) => updateMessage(index, 'date', e.target.value)}
                  className="admin-form-input"
                  style={{ maxWidth: '200px' }}
                />
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="admin-empty-state">
              Aucun message trouvé. Cliquez sur "Ajouter un message" pour commencer.
            </div>
          )}
        </div>
      ) : activeTab === 'events' ? (
        <div className="admin-messages-grid">
          {events.map((event, index) => (
            <div key={index} className="admin-message-card">
              <div className="admin-message-header">
                <h3 className="admin-message-title">Événement {index + 1}</h3>
                <button
                  onClick={() => removeEvent(index)}
                  className="admin-btn admin-btn-danger"
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  Supprimer
                </button>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Titre:
                </label>
                <input
                  type="text"
                  value={event.title}
                  onChange={(e) => updateEvent(index, 'title', e.target.value)}
                  className="admin-form-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Date:
                </label>
                <input
                  type="date"
                  value={event.date}
                  onChange={(e) => updateEvent(index, 'date', e.target.value)}
                  className="admin-form-input"
                  style={{ maxWidth: '200px' }}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Lieu:
                </label>
                <input
                  type="text"
                  value={event.location}
                  onChange={(e) => updateEvent(index, 'location', e.target.value)}
                  className="admin-form-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  URL:
                </label>
                <input
                  type="url"
                  value={event.url}
                  onChange={(e) => updateEvent(index, 'url', e.target.value)}
                  placeholder="ex: https://www.facebook.com/events/..."
                  className="admin-form-input"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Couleur:
                </label>
                <input
                  type="color"
                  value={event.color}
                  onChange={(e) => updateEvent(index, 'color', e.target.value)}
                  className="admin-form-input"
                  style={{ width: '60px', height: '40px' }}
                />
              </div>

              <ImageUpload
                value={event.image}
                onChange={(value) => updateEvent(index, 'image', value)}
                placeholder="ex: events/lancement.webp"
              />
            </div>
          ))}

          {events.length === 0 && (
            <div className="admin-empty-state">
              Aucun événement trouvé. Cliquez sur "Ajouter un événement" pour commencer.
            </div>
          )}
        </div>
      ) : (
        <div className="admin-messages-grid">
          <div className="admin-message-card">
            <div className="admin-message-header">
              <h3 className="admin-message-title">Bio</h3>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Texte de la bio:
              </label>
              <textarea
                value={bio.text}
                onChange={(e) => updateBio('text', e.target.value)}
                rows={8}
                className="admin-form-textarea"
                placeholder="Écrivez votre bio ici..."
              />
              <small className="upload-help">
                Cette bio apparaîtra sur la page principale de votre site.
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
