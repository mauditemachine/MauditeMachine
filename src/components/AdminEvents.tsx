import React, { useState, useEffect } from 'react';
import { loadEvents, saveEvents, Event } from '../utils/adminApi';
import ImageUpload from './ImageUpload';

const AdminEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<Event>({
    date: '',
    title: '',
    url: '',
    location: '',
    color: '#ff6d9e',
    image: ''
  });

  useEffect(() => {
    loadEventsData();
  }, []);

  const loadEventsData = async () => {
    try {
      setLoading(true);
      const data = await loadEvents();
      // Trier les événements par date (plus récents en premier)
      const sortedEvents = [...data].sort((a, b) => b.date.localeCompare(a.date));
      setEvents(sortedEvents);
    } catch (error) {
      console.error('Erreur lors du chargement des événements:', error);
      setMessage('Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.title || !formData.date || !formData.location) {
      setMessage('⚠️ Veuillez remplir au moins le titre, la date et le lieu');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setSaving(true);
    try {
      let updatedEvents;
      if (editingIndex !== null) {
        // Modification
        updatedEvents = [...events];
        updatedEvents[editingIndex] = formData;
      } else {
        // Ajout
        updatedEvents = [...events, formData];
      }
      
      // Trier par date
      updatedEvents.sort((a, b) => b.date.localeCompare(a.date));
      
      const result = await saveEvents(updatedEvents);
      
      if (result.success) {
        setEvents(updatedEvents);
        setMessage('✅ ' + result.message);
        resetForm();
      } else {
        setMessage('❌ ' + result.message);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEdit = (index: number) => {
    setFormData(events[index]);
    setEditingIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (index: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
      return;
    }

    setSaving(true);
    try {
      const updatedEvents = events.filter((_, i) => i !== index);
      const result = await saveEvents(updatedEvents);
      
      if (result.success) {
        setEvents(updatedEvents);
        setMessage('✅ Événement supprimé');
        if (editingIndex === index) {
          resetForm();
        }
      } else {
        setMessage('❌ ' + result.message);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setMessage('❌ Erreur lors de la suppression');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const resetForm = () => {
    setFormData({
      date: '',
      title: '',
      url: '',
      location: '',
      color: '#ff6d9e',
      image: ''
    });
    setEditingIndex(null);
  };

  const updateFormField = (field: keyof Event, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        <div>Chargement...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem'
        }}>
          <h1 style={{
            color: 'white',
            fontSize: '3rem',
            fontWeight: 'bold',
            margin: '0 0 0.5rem 0',
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
          }}>
            📅 GESTION DES ÉVÉNEMENTS
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '1.1rem'
          }}>
            Ajoutez et gérez vos événements facilement
          </p>
        </div>

        {/* Message de statut */}
        {message && (
          <div style={{
            background: message.includes('❌') ? '#ef4444' : '#10b981',
            color: 'white',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            textAlign: 'center',
            fontWeight: '500',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            {message}
          </div>
        )}

        {/* Formulaire */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            color: '#667eea',
            marginTop: 0,
            marginBottom: '1.5rem',
            fontSize: '1.5rem'
          }}>
            {editingIndex !== null ? '✏️ Modifier l\'événement' : '➕ Nouvel événement'}
          </h2>

          <div style={{
            display: 'grid',
            gap: '1.5rem'
          }}>
            {/* Titre */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                Titre de l'événement *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                placeholder="Ex: LUMIERE NOIRE"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Date et Lieu */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateFormField('date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Lieu *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => updateFormField('location', e.target.value)}
                  placeholder="Ex: Théâtre du Lion d'Or - Mtl"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            </div>

            {/* Lien */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                Lien de l'événement
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => updateFormField('url', e.target.value)}
                placeholder="Ex: https://www.facebook.com/events/..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Couleur et Image */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr',
              gap: '1rem',
              alignItems: 'start'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Couleur
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => updateFormField('color', e.target.value)}
                    style={{
                      width: '60px',
                      height: '45px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => updateFormField('color', e.target.value)}
                    style={{
                      width: '100px',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Photo de l'événement
                </label>
                <ImageUpload
                  value={formData.image}
                  onChange={(value) => updateFormField('image', value)}
                  placeholder="Ex: events/lancement.webp"
                  useButton={true}
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '1rem'
            }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                {saving ? 'Sauvegarde...' : (editingIndex !== null ? '💾 Mettre à jour' : '➕ Ajouter l\'événement')}
              </button>

              {editingIndex !== null && (
                <button
                  onClick={resetForm}
                  style={{
                    padding: '1rem 2rem',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#4b5563'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#6b7280'}
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Liste des événements */}
        <div>
          <h2 style={{
            color: 'white',
            marginBottom: '1.5rem',
            fontSize: '1.8rem',
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
          }}>
            📋 Événements existants ({events.length})
          </h2>

          {events.length === 0 ? (
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '3rem',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '1.1rem'
            }}>
              Aucun événement pour le moment. Ajoutez-en un ci-dessus ! 🎉
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '1rem'
            }}>
              {events.map((event, index) => (
                <div
                  key={index}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: '1.5rem',
                    alignItems: 'center',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                  }}
                >
                  {/* Indicateur de couleur */}
                  <div style={{
                    width: '4px',
                    height: '80px',
                    background: event.color,
                    borderRadius: '2px'
                  }} />

                  {/* Informations */}
                  <div>
                    <h3 style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '1.3rem',
                      color: '#1f2937',
                      fontWeight: 'bold'
                    }}>
                      {event.title}
                    </h3>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      color: '#6b7280',
                      fontSize: '0.95rem'
                    }}>
                      <span>📅 {(() => {
                        const [year, month, day] = event.date.split('-');
                        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        });
                      })()}</span>
                      <span>📍 {event.location}</span>
                      {event.url && (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#667eea',
                            textDecoration: 'none',
                            fontWeight: '500'
                          }}
                        >
                          🔗 Lien
                        </a>
                      )}
                    </div>
                    {event.image && (
                      <div style={{
                        marginTop: '0.5rem',
                        fontSize: '0.85rem',
                        color: '#9ca3af'
                      }}>
                        🖼️ {event.image}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem'
                  }}>
                    <button
                      onClick={() => handleEdit(index)}
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      disabled={saving}
                      style={{
                        padding: '0.75rem 1.25rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.5 : 1,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!saving) e.currentTarget.style.background = '#dc2626';
                      }}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            💡 Les modifications sont automatiquement sauvegardées dans le fichier events.json
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminEvents;

