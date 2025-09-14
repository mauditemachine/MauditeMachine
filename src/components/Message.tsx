/**
 * Composant pour la page Message / Contact
 */

import React, { useState } from 'react';
import emailjs from '@emailjs/browser';

// Configuration EmailJS avec vos vraies clés
const SERVICE_ID = 'service_zeuwh04';
const TEMPLATE_ID = 'template_zlot6be';
const PUBLIC_KEY = '_e6k6nftsmZZxs29b';

const Message: React.FC = () => {
  const [formData, setFormData] = useState({
    from_name: '',
    from_email: '',
    object: '',
    message: ''
  });
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [userCaptchaAnswer, setUserCaptchaAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

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
      setSubmitStatus('Please fill in all fields.');
      return;
    }
    
    if (!showCaptcha) {
      generateCaptcha();
      setShowCaptcha(true);
      setSubmitStatus('');
      return;
    }
    
    if (userCaptchaAnswer !== captchaAnswer) {
      setSubmitStatus('Incorrect captcha answer. Please try again.');
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
      setSubmitStatus('Message sent successfully! We will get back to you soon.');
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
      setSubmitStatus('Erreur lors de l\'envoi. Please try again or contact us directly.');
    });
  };

  return (
    <div className="message-container">
      <div className="message-content">
        <div className="message-header">
          <p className="message-subtitle">
            For interviews, bookings, and media inquiries, please write a message here
          </p>
        </div>

        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label htmlFor="from_name" className="form-label">Name</label>
            <input
              type="text"
              id="from_name"
              name="from_name"
              value={formData.from_name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Your name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="from_email" className="form-label">Email</label>
            <input
              type="email"
              id="from_email"
              name="from_email"
              value={formData.from_email}
              onChange={handleInputChange}
              className="form-input"
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="object" className="form-label">Object</label>
            <input
              type="text"
              id="object"
              name="object"
              value={formData.object}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Booking, collaboration, inquiry..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="message" className="form-label">Message</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder="Your message here..."
              rows={6}
              required
            />
          </div>

          {showCaptcha && (
            <div className="form-group captcha-group">
              <label htmlFor="captcha" className="form-label">
                Security Check: What is {captchaQuestion} ?
              </label>
              <input
                type="text"
                id="captcha"
                value={userCaptchaAnswer}
                onChange={(e) => setUserCaptchaAnswer(e.target.value)}
                className="form-input captcha-input"
                placeholder="Enter the answer"
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className={`submit-button ${isSubmitting ? 'submitting' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'SENDING' : showCaptcha ? 'SEND' : 'SEND'}
          </button>

          {submitStatus && (
            <div className={`submit-status ${submitStatus.includes('success') ? 'success' : 'error'}`}>
              {submitStatus}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Message;
