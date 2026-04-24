/**
 * Page Message / Contact — design Pro Max en Tailwind + Framer Motion.
 *
 * Migration 2026-04 : 100% Tailwind, conteneur glass, inputs "en creux",
 * focus glow blanc, submit button avec micro-interaction.
 */

import React, { useState } from 'react'
import emailjs from '@emailjs/browser'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { cn } from '../lib/cn'

// EmailJS config
const SERVICE_ID = 'service_zeuwh04'
const TEMPLATE_ID = 'template_zlot6be'
const PUBLIC_KEY = '_e6k6nftsmZZxs29b'

interface MessageProps {
  prefillSubject?: string
  prefillMessage?: string
}

// Tailwind helper : input/textarea "en creux" + focus glow blanc
const FIELD_BASE = cn(
  'w-full px-4 py-3 rounded-lg',
  'bg-black/30 border border-ink-10',
  'text-ink-95 font-body text-[15px]',
  'placeholder:text-ink-50',
  'transition-all duration-250 ease-out-expo',
  'focus:outline-none focus:border-ink-50 focus:bg-black/40',
  'focus:ring-1 focus:ring-ink-30',
)

const LABEL_BASE = cn(
  'block mb-2 font-body',
  'text-sm font-bold uppercase tracking-[0.15em]',
  'text-ink-85',
)

const Message: React.FC<MessageProps> = ({ prefillSubject, prefillMessage }) => {
  const { t } = useApp()
  const [formData, setFormData] = useState({
    from_name: '',
    from_email: '',
    object: prefillSubject || '',
    message: prefillMessage || '',
  })
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [userCaptchaAnswer, setUserCaptchaAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('')

  React.useEffect(() => {
    if (prefillSubject || prefillMessage) {
      setFormData((prev) => ({
        ...prev,
        object: prefillSubject || prev.object,
        message: prefillMessage || prev.message,
      }))
    }
  }, [prefillSubject, prefillMessage])

  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1
    const num2 = Math.floor(Math.random() * 10) + 1
    const ops = ['+', '-', '×']
    const op = ops[Math.floor(Math.random() * ops.length)]
    let answer = 0
    let question = ''
    switch (op) {
      case '+':
        answer = num1 + num2
        question = `${num1} + ${num2}`
        break
      case '-':
        answer = Math.max(num1, num2) - Math.min(num1, num2)
        question = `${Math.max(num1, num2)} - ${Math.min(num1, num2)}`
        break
      case '×':
        answer = num1 * num2
        question = `${num1} × ${num2}`
        break
    }
    setCaptchaQuestion(question)
    setCaptchaAnswer(answer.toString())
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !formData.from_name.trim() ||
      !formData.from_email.trim() ||
      !formData.object.trim() ||
      !formData.message.trim()
    ) {
      setSubmitStatus(t.contact.fillAll)
      setStatusType('error')
      return
    }

    if (!showCaptcha) {
      generateCaptcha()
      setShowCaptcha(true)
      setSubmitStatus('')
      setStatusType('')
      return
    }

    if (userCaptchaAnswer !== captchaAnswer) {
      setSubmitStatus(t.contact.captchaError)
      setStatusType('error')
      generateCaptcha()
      setUserCaptchaAnswer('')
      return
    }

    setIsSubmitting(true)
    emailjs
      .sendForm(SERVICE_ID, TEMPLATE_ID, e.target as HTMLFormElement, PUBLIC_KEY)
      .then(() => {
        setIsSubmitting(false)
        setSubmitStatus(t.contact.success)
        setStatusType('success')
        setFormData({ from_name: '', from_email: '', object: '', message: '' })
        setShowCaptcha(false)
        setUserCaptchaAnswer('')

        if (typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('track', 'Contact', {
            content_name: 'Contact Form Submission',
            content_category: 'Lead Generation',
          })
        }
      })
      .catch((error) => {
        console.error('EmailJS error:', error)
        setIsSubmitting(false)
        setSubmitStatus(t.contact.error)
        setStatusType('error')
      })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      className="w-full max-w-2xl mx-auto py-6 md:py-10"
    >
      {/* Conteneur glass principal */}
      <div
        className={cn(
          'rounded-2xl p-6 md:p-10',
          'bg-glass-strong backdrop-blur-heavy backdrop-saturate-glass',
          'border border-ink-10 shadow-glass-lg',
        )}
      >
        {/* Header / subtitle */}
        <div className="text-center mb-6 md:mb-8">
          <p className="text-ink-85 text-sm md:text-[15px] leading-relaxed">
            {t.contact.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label htmlFor="from_name" className={LABEL_BASE}>
              {t.contact.name}
            </label>
            <input
              type="text"
              id="from_name"
              name="from_name"
              value={formData.from_name}
              onChange={handleInputChange}
              className={FIELD_BASE}
              placeholder={t.contact.namePlaceholder}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="from_email" className={LABEL_BASE}>
              {t.contact.email}
            </label>
            <input
              type="email"
              id="from_email"
              name="from_email"
              value={formData.from_email}
              onChange={handleInputChange}
              className={FIELD_BASE}
              placeholder={t.contact.emailPlaceholder}
              required
            />
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="object" className={LABEL_BASE}>
              {t.contact.subject}
            </label>
            <input
              type="text"
              id="object"
              name="object"
              value={formData.object}
              onChange={handleInputChange}
              className={FIELD_BASE}
              placeholder={t.contact.subjectPlaceholder}
              required
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className={LABEL_BASE}>
              {t.contact.message}
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              className={cn(FIELD_BASE, 'min-h-[180px] resize-y leading-relaxed')}
              placeholder={t.contact.messagePlaceholder}
              rows={6}
              required
            />
          </div>

          {/* Captcha */}
          {showCaptcha && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className={cn(
                'p-4 rounded-lg',
                'bg-ink-5 border border-ink-10',
              )}
            >
              <label htmlFor="captcha" className={LABEL_BASE}>
                {t.contact.captcha} {captchaQuestion} ?
              </label>
              <input
                type="text"
                id="captcha"
                value={userCaptchaAnswer}
                onChange={(e) => setUserCaptchaAnswer(e.target.value)}
                className={cn(FIELD_BASE, 'max-w-[180px]')}
                placeholder={t.contact.captchaPlaceholder}
                required
              />
            </motion.div>
          )}

          {/* Submit */}
          <div className="flex justify-center mt-2">
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={!isSubmitting ? { scale: 1.03 } : {}}
              whileTap={!isSubmitting ? { scale: 0.97 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={cn(
                'relative inline-flex items-center justify-center',
                'px-10 py-3 rounded-full',
                'bg-ink-10 hover:bg-ink-15',
                'border border-ink-20 hover:border-ink-50',
                'text-ink-95 font-body',
                'text-sm font-bold uppercase tracking-[0.2em]',
                'transition-all duration-300 ease-out-expo',
                'hover:shadow-glow-white-soft',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink-10 disabled:hover:border-ink-20 disabled:hover:shadow-none',
              )}
            >
              {isSubmitting ? t.contact.sending : t.contact.send}
            </motion.button>
          </div>

          {/* Status */}
          {submitStatus && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'text-center p-3 rounded-lg text-sm font-semibold border',
                statusType === 'success' &&
                  'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                statusType === 'error' &&
                  'bg-red-500/10 border-red-500/30 text-red-300',
              )}
            >
              {submitStatus}
            </motion.div>
          )}
        </form>
      </div>
    </motion.div>
  )
}

export default Message
