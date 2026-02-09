import React, { useEffect, useState } from 'react'
import { loadMessages } from '../utils/adminApi'

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

  const fetchMessages = async () => {
    try {
      const data = await loadMessages()
      setMessages(data)
    } catch (err) {
      setError('Failed to load messages')
    }
  }

  useEffect(() => {
    fetchMessages()

    // Écouter les mises à jour depuis l'admin
    const handleUpdate = () => fetchMessages()
    window.addEventListener('messagesUpdated', handleUpdate)
    return () => window.removeEventListener('messagesUpdated', handleUpdate)
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
