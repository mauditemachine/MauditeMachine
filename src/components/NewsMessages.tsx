import React, { useEffect, useState } from 'react'
import { loadMessages } from '../utils/adminApi'

type MessageItem = {
  id: string
  title: string
  description?: string
  image?: string
  link?: { label: string; href: string }
  date?: string
  main?: boolean
}

export default function NewsMessages(): JSX.Element {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<'main' | 'cycle'>('main') // main = 20s, cycle = 10s

  const fetchMessages = async () => {
    try {
      // Priorité au backup mm-admin pour afficher la même news que l'admin
      const data = await loadMessages(true)
      setMessages(data)
    } catch (err) {
      setError('Failed to load messages')
    }
  }

  useEffect(() => {
    fetchMessages()
    const handleUpdate = () => fetchMessages()
    window.addEventListener('messagesUpdated', handleUpdate)
    return () => window.removeEventListener('messagesUpdated', handleUpdate)
  }, [])

  // Main en premier 20s, puis cycle toutes les 10s (mobile et desktop)
  const mainMsg = messages.find(m => m.main)
  const others = messages.filter(m => !m.main)
  const cycleList = mainMsg ? [mainMsg, ...others] : messages
  const hasMain = !!mainMsg && cycleList.length > 1

  useEffect(() => {
    if (cycleList.length === 0) return
    if (cycleList.length === 1) return

    if (hasMain && phase === 'main') {
      const t = setTimeout(() => {
        setPhase('cycle')
        setCurrentIndex(1) // après main, commencer par la suivante
      }, 20000)
      return () => clearTimeout(t)
    }
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % cycleList.length)
    }, 10000)
    return () => clearInterval(interval)
  }, [cycleList.length, hasMain, phase])

  if (error) return <div>Error loading messages</div>

  const messageToShow = cycleList.length === 0
    ? null
    : cycleList.length === 1
      ? cycleList[0]
      : hasMain && phase === 'main'
        ? mainMsg!
        : cycleList[currentIndex]

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
