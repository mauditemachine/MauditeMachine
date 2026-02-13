/**
 * Composant pour la page Message / Contact
 */

import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { useApp } from '../context/AppContext';

// Configuration EmailJS avec vos vraies clés
const SERVICE_ID = 'service_zeuwh04';
const TEMPLATE_ID = 'template_zlot6be';
const PUBLIC_KEY = '_e6k6nftsmZZxs29b';

interface MessageProps {
  prefillSubject?: string;
  prefillMessage?: string;
}

const Message: React.FC<MessageProps> = ({ prefillSubject, prefillMessage }) => {
  const { t } = useApp();
  const [formData, setFormData] = useState({
    from_name: '',
    from_email: '',
    object: prefillSubject || '',
    message: prefillMessage || ''
  });
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [userCaptchaAnswer, setUserCaptchaAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  // Mettre à jour le formulaire quand les props de préremplissage changent
  React.useEffect(() => {
    if (prefillSubject || prefillMessage) {
      setFormData(prev => ({
        ...prev,
        object: prefillSubject || prev.object,
        message: prefillMessage || prev.message
      }));
    }
  }, [prefillSubject, prefillMessage]);

  // Générer une question de captcha simple
  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer = 0;
    let question = '';
    
    switch (operator) {
      case '+':
        answer = num1 + num2;
        question = `${num1} + ${num2}`;
        break;
      case '-':
        answer = Math.max(num1, num2) - Math.min(num1, num2);
        question = `${Math.max(num1, num2)} - ${Math.min(num1, num2)}`;
        break;
      case '×':
        answer = num1 * num2;
        question = `${num1} × ${num2}`;
        break;
    }
    
    setCaptchaQuestion(question);
    setCaptchaAnswer(answer.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.from_name.trim() || !formData.from_email.trim() || !formData.object.trim() || !formData.message.trim()) {
      setSubmitStatus(t.contact.fillAll);
      return;
    }
    
    if (!showCaptcha) {
      generateCaptcha();
      setShowCaptcha(true);
      setSubmitStatus('');
      return;
    }
    
    if (userCaptchaAnswer !== captchaAnswer) {
      setSubmitStatus(t.contact.captchaError);
      generateCaptcha();
      setUserCaptchaAnswer('');
      return;
    }
    
    // Envoyer le message via EmailJS
    setIsSubmitting(true);
    
    // Envoi direct via EmailJS avec votre méthode
    emailjs.sendForm(
      SERVICE_ID,           // service_zeuwh04
      TEMPLATE_ID,          // template_zlot6be  
      e.target as HTMLFormElement,
      PUBLIC_KEY            // _e6k6nftsmZZxs29b
    ).then(() => {
      setIsSubmitting(false);
      setSubmitStatus(t.contact.success);
      setFormData({ from_name: '', from_email: '', object: '', message: '' });
      setShowCaptcha(false);
      setUserCaptchaAnswer('');
      
      // Tracking Facebook Pixel pour l'envoi de message
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Contact', {
          content_name: 'Contact Form Submission',
          content_category: 'Lead Generation'
        });
      }
    }).catch((error) => {
      console.error('Erreur EmailJS:', error);
      setIsSubmitting(false);
      setSubmitStatus(t.contact.error);
    });
  };

  return (
    <div className="message-container">
      <div className="message-content">
        <div className="message-header">
          <p className="message-subtitle">
            {t.contact.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label htmlFor="from_name" className="form-label">{t.contact.name}</label>
            <input
              type="text"
              id="from_name"
              name="from_name"
              value={formData.from_name}
              onChange={handleInputChange}
              className="form-input"
              placeholder={t.contact.namePlaceholder}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="from_email" className="form-label">{t.contact.email}</label>
            <input
              type="email"
              id="from_email"
              name="from_email"
              value={formData.from_email}
              onChange={handleInputChange}
              className="form-input"
              placeholder={t.contact.emailPlaceholder}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="object" className="form-label">{t.contact.subject}</label>
            <input
              type="text"
              id="object"
              name="object"
              value={formData.object}
              onChange={handleInputChange}
              className="form-input"
              placeholder={t.contact.subjectPlaceholder}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="message" className="form-label">{t.contact.message}</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder={t.contact.messagePlaceholder}
              rows={6}
              required
            />
          </div>

          {showCaptcha && (
            <div className="form-group captcha-group">
              <label htmlFor="captcha" className="form-label">
                {t.contact.captcha} {captchaQuestion} ?
              </label>
              <input
                type="text"
                id="captcha"
                value={userCaptchaAnswer}
                onChange={(e) => setUserCaptchaAnswer(e.target.value)}
                className="form-input captcha-input"
                placeholder={t.contact.captchaPlaceholder}
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className={`submit-button ${isSubmitting ? 'submitting' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? t.contact.sending : t.contact.send}
          </button>

          {submitStatus && (
            <div className={`submit-status ${submitStatus.includes('success') || submitStatus.includes('succes') ? 'success' : 'error'}`}>
              {submitStatus}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Message;
