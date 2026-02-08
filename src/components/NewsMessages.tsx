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

  const displayMessages = messages.slice(0, 1)

  return (
    <div className="news-section">
      {displayMessages.map((message, index) => {
        const linkHref = message.link?.href || '#';
        const isClickable = !!message.link?.href;
        
        return (
          <a 
            key={index} 
            className="news-message-link"
            href={linkHref}
            target={isClickable ? "_blank" : undefined}
            rel={isClickable ? "noreferrer" : undefined}
          >
            <div className="message-card">
              {message.image && (
                <img 
                  className="message-image" 
                  src={message.image.startsWith('data:') ? message.image : `/${message.image}`} 
                  alt={message.title}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!message.image.startsWith('data:') && !message.image.startsWith('/')) {
                      target.src = `/${message.image}`;
                    }
                  }}
                />
              )}
              <div className="message-body">
                <div className="message-title">{message.title}</div>
                {message.description && (
                  <div className="message-desc">{message.description}</div>
                )}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  )
}
