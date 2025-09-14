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
          // Trier les messages par date (du plus récent au plus ancien)
          const sortedMessages = Array.isArray(data) ? data.sort((a, b) => {
            const dateA = new Date(a.date || '1970-01-01').getTime()
            const dateB = new Date(b.date || '1970-01-01').getTime()
            return dateB - dateA // Ordre décroissant (plus récent en premier)
          }) : []
          setMessages(sortedMessages)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load messages')
        }
      }
    }
    
    loadMessagesData()
    return () => { cancelled = true }
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
