import React, { useEffect, useState } from 'react'
import { loadMessages, Message } from '../utils/adminApi'

type MessageItem = {
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
        const data = await loadMessages()
        if (!cancelled) {
          // Utiliser l'ordre de l'admin (pas de tri par date)
          const messages = Array.isArray(data) ? data : []
          console.log('Messages chargés dans NewsMessages:', messages)
          setMessages(messages)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur chargement messages:', err)
          setError('Failed to load messages')
        }
      }
    }
    
    // Charger les messages au montage
    loadMessagesData()
    
    // Écouter les mises à jour depuis l'admin
    const handleMessagesUpdate = () => {
      if (!cancelled) {
        console.log('Événement messagesUpdated reçu, rechargement...')
        loadMessagesData()
      }
    }
    
    window.addEventListener('messagesUpdated', handleMessagesUpdate)
    
    // Forcer une synchronisation au démarrage
    setTimeout(() => {
      if (!cancelled) {
        console.log('Synchronisation forcée des messages...')
        loadMessagesData()
      }
    }, 1000)
    
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
