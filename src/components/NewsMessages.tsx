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
        console.log('🔄 Chargement des messages...')
        const data = await loadMessages()
        if (!cancelled) {
          const messages = Array.isArray(data) ? data : []
          console.log('✅ Messages chargés:', messages.length, 'messages')
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
    
    // Écouter les mises à jour depuis l'admin
    const handleMessagesUpdate = () => {
      if (!cancelled) {
        console.log('🔔 Événement messagesUpdated reçu')
        loadMessagesData()
      }
    }
    
    window.addEventListener('messagesUpdated', handleMessagesUpdate)
    
    // SYNCHRONISATION ULTRA-AGRESSIVE - toutes les 1 seconde
    const syncInterval = setInterval(() => {
      if (!cancelled) {
        console.log('🔄 Sync automatique...')
        loadMessagesData()
      }
    }, 1000) // Toutes les 1 seconde
    
    // Sync immédiate après 100ms
    setTimeout(() => {
      if (!cancelled) {
        console.log('🔄 Sync immédiate...')
        loadMessagesData()
      }
    }, 100)
    
    // Sync après 1 seconde
    setTimeout(() => {
      if (!cancelled) {
        console.log('🔄 Sync 1s...')
        loadMessagesData()
      }
    }, 1000)
    
    // Sync après 3 secondes
    setTimeout(() => {
      if (!cancelled) {
        console.log('🔄 Sync 3s...')
        loadMessagesData()
      }
    }, 3000)
    
    return () => { 
      cancelled = true
      window.removeEventListener('messagesUpdated', handleMessagesUpdate)
      clearInterval(syncInterval)
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
