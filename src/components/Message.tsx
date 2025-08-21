/**
 * Composant pour la page Message / Contact
 */

import React, { useState } from 'react';
import emailjs from '@emailjs/browser';

// Configuration EmailJS - Remplace par tes vraies clés après avoir configuré EmailJS
const SERVICE_ID = 'YOUR_SERVICE_ID'; // À remplacer
const TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; // À remplacer
const PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // À remplacer

const Message: React.FC = () => {
  const [formData, setFormData] = useState({
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
    
    if (!formData.object.trim() || !formData.message.trim()) {
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
    
    // Vérifier si EmailJS est configuré
    if (SERVICE_ID === 'YOUR_SERVICE_ID' || TEMPLATE_ID === 'YOUR_TEMPLATE_ID' || PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
      // Configuration EmailJS non faite - simulation
      console.log('⚠️ EmailJS non configuré. Message simulé:', {
        to: 'mauditemachine@gmail.com',
        object: formData.object,
        message: formData.message
      });
      console.log('📧 Pour recevoir de vrais emails, configure EmailJS (voir EMAILJS_SETUP.md)');
      
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitStatus('Message sent successfully! (Simulated - Configure EmailJS to receive real emails)');
        setFormData({ object: '', message: '' });
        setShowCaptcha(false);
        setUserCaptchaAnswer('');
      }, 2000);
      return;
    }
    
    // Envoi réel via EmailJS
    const templateParams = {
      object: formData.object,
      message: formData.message,
      date: new Date().toLocaleString()
    };
    
    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then(() => {
        setIsSubmitting(false);
        setSubmitStatus('Message sent successfully! We will get back to you soon.');
        setFormData({ object: '', message: '' });
        setShowCaptcha(false);
        setUserCaptchaAnswer('');
      })
      .catch((error) => {
        console.error('Erreur EmailJS:', error);
        setIsSubmitting(false);
        setSubmitStatus('Error sending message. Please try again or contact us directly.');
      });
  };

  return (
    <div className="message-container">
      <div className="message-content">
        <div className="message-header">
          <h2 className="message-title">Contact</h2>
          <p className="message-subtitle">
            Contact Maudite Machine for bookings and inquiries via the form below or email{' '}
            <span className="email-address">vrstlrecords@gmail.com</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="contact-form">
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
