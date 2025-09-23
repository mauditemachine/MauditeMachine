import React, { useEffect, useState } from 'react'

type MessageItem = {
  id: string
  title: string
  description?: string
  image?: string
  link?: { label: string; href: string }
  date?: string
}

export default function NewsMessages(): JSX.Element {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    
    const loadMessagesData = async () => {
      try {
        console.log('🔄 Chargement des messages depuis JSON...')
        
        // Chargement direct depuis le JSON public avec cache-busting agressif
        const timestamp = Date.now()
        const random = Math.random()
        const response = await fetch(`/messages.json?t=${timestamp}&force=${random}&cache=${Math.random()}`)
        
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des messages')
        }
        const messages = await response.json()
        
        if (!cancelled) {
          console.log('✅ Messages chargés depuis JSON:', messages.length, 'messages')
          console.log('📸 Première image:', messages[0]?.image)
          setMessages(messages)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Erreur chargement messages:', err)
          setError('Failed to load messages')
        }
      }
    }
    
    // Charger immédiatement
    loadMessagesData()
    
    // Écouter les mises à jour depuis l'admin (synchronisation automatique)
    const handleMessagesUpdate = () => {
      if (!cancelled) {
        console.log('🔔 Événement messagesUpdated reçu (sync auto)')
        loadMessagesData()
      }
    }
    
    window.addEventListener('messagesUpdated', handleMessagesUpdate)
    
    return () => { 
      cancelled = true
      window.removeEventListener('messagesUpdated', handleMessagesUpdate)
    }
  }, [])

  if (error) return <div>Error loading messages</div>

  return (
    <div className="news-section">
      {messages.map((message, index) => (
        <div key={index} className="news-message">
          <div className="message-card">
            <div className="message-body">
              <div className="message-title">{message.title}</div>
              {message.description && (
                <div className="message-desc">{message.description}</div>
              )}
              {message.link && message.link.label && message.link.href && (
                <a 
                  className="message-link" 
                  href={message.link.href} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  {message.link.label}
                </a>
              )}
            </div>
            {message.image && (
              <img 
                className="message-image" 
                src={message.image.startsWith('data:') ? message.image : `/${message.image}`} 
                alt={message.title}
                onError={(e) => {
                  // Si l'image ne charge pas, essayer avec le chemin relatif
                  const target = e.target as HTMLImageElement;
                  if (!message.image.startsWith('data:') && !message.image.startsWith('/')) {
                    target.src = `/${message.image}`;
                  }
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
