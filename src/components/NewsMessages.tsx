import React, { useEffect, useState } from 'react'

type MessageItem = {
  title: string
  description?: string
  image?: string
  link?: { label: string; href: string }
}

export default function NewsMessages(): JSX.Element {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/medias/messages.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then((data: MessageItem[]) => { 
        if (!cancelled) setMessages(Array.isArray(data) ? data : []) 
      })
      .catch(() => { 
        if (!cancelled) setError('Failed to load messages') 
      })
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
                src={message.image} 
                alt={message.title} 
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
