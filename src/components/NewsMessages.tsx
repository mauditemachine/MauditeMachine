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
  const [currentIndex, setCurrentIndex] = useState(0)

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

  // Alterner entre les 2 premières news toutes les 10 secondes
  const displayMessages = messages.slice(0, 2)
  useEffect(() => {
    if (displayMessages.length < 2) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % 2)
    }, 10000)
    return () => clearInterval(interval)
  }, [displayMessages.length])

  if (error) return <div>Error loading messages</div>

  const messageToShow = displayMessages.length === 2 
    ? displayMessages[currentIndex] 
    : displayMessages[0]

  if (!messageToShow) return <div className="news-section" />

  const linkHref = messageToShow.link?.href || '#';
  const isClickable = !!messageToShow.link?.href;

  return (
    <div className="news-section news-rotating">
      <a 
        key={messageToShow.id}
        className="news-message-link"
        href={linkHref}
        target={isClickable ? "_blank" : undefined}
        rel={isClickable ? "noreferrer" : undefined}
      >
        <div key={messageToShow.id} className="message-card">
          {messageToShow.image && (
            <img 
              className="message-image" 
              src={messageToShow.image.startsWith('data:') ? messageToShow.image : `/${messageToShow.image}`} 
              alt={messageToShow.title}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!messageToShow.image.startsWith('data:') && !messageToShow.image.startsWith('/')) {
                  target.src = `/${messageToShow.image}`;
                }
              }}
            />
          )}
          <div className="message-body">
            <div className="message-title">{messageToShow.title}</div>
            {messageToShow.description && (
              <div className="message-desc">{messageToShow.description}</div>
            )}
          </div>
        </div>
      </a>
    </div>
  )
}
