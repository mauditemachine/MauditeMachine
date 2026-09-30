/**
 * Formulaire de CONTACT (2026-10-01) : un vrai courriel a Mika, envoye par
 * EmailJS (le compte et le modele du formulaire de /v1, src/data/emailjs.ts),
 * sans quitter la page. Nom, courriel, objet, message. L'objet (et parfois
 * le message) arrive rempli selon d'ou vient le visiteur (state/
 * contactDraft.ts : Booking, Merch order - <produit>, Lesson, Press) ; il
 * reste modifiable. La bibliotheque d'EmailJS ne se charge qu'a l'envoi.
 * Anti-robots : un champ piege invisible (un robot le remplit, un humain
 * ne le voit pas) ; rempli, rien ne part.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EMAILJS } from '../../../data/emailjs';
import { contactDraft } from '../../state/contactDraft';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FALLBACK_EMAIL = 'mauditemachine@gmail.com';

export const ContactForm: React.FC<{ tab: number }> = ({ tab }) => {
  const d = useSyncExternalStore(contactDraft.subscribe, contactDraft.get, contactDraft.get);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(d.subject);
  const [message, setMessage] = useState(d.message);
  const [trap, setTrap] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  // Le visiteur a ecrit son propre message : une nouvelle demande ne l'efface pas
  const typed = useRef(false);

  useEffect(() => {
    setSubject(d.subject);
    if (!typed.current || d.message) {
      setMessage(d.message);
      typed.current = false;
    }
    setStatus('idle');
  }, [d.seq, d.subject, d.message]);

  const send = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (status === 'sending') return;
    if (trap) {
      setStatus('sent');
      return;
    }
    setStatus('sending');
    try {
      const { default: emailjs } = await import('@emailjs/browser');
      await emailjs.send(
        EMAILJS.serviceId,
        EMAILJS.templateId,
        {
          from_name: name.trim(),
          from_email: email.trim(),
          reply_to: email.trim(),
          object: subject.trim(),
          message: message.trim(),
        },
        { publicKey: EMAILJS.publicKey }
      );
      setStatus('sent');
      setMessage('');
      typed.current = false;
      const w = window as Window & { fbq?: (...args: unknown[]) => void };
      w.fbq?.('track', 'Contact', { content_name: 'Contact form', content_category: subject.trim() });
    } catch {
      setStatus('error');
    }
  };

  const busy = status === 'sending';
  return (
    <form className="v4-form" onSubmit={send} noValidate={false}>
      <label className="v4-field">
        <span className="v4-field-label">Name</span>
        <input
          className="v4-input"
          type="text"
          name="from_name"
          autoComplete="name"
          required
          maxLength={120}
          value={name}
          tabIndex={tab}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="v4-field">
        <span className="v4-field-label">Email</span>
        <input
          className="v4-input"
          type="email"
          name="from_email"
          autoComplete="email"
          required
          maxLength={200}
          value={email}
          tabIndex={tab}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="v4-field">
        <span className="v4-field-label">Subject</span>
        <input
          className="v4-input"
          type="text"
          name="object"
          required
          maxLength={160}
          value={subject}
          tabIndex={tab}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <label className="v4-field">
        <span className="v4-field-label">Message</span>
        <textarea
          className="v4-input v4-textarea"
          name="message"
          required
          rows={6}
          maxLength={5000}
          value={message}
          tabIndex={tab}
          onChange={(e) => {
            typed.current = true;
            setMessage(e.target.value);
          }}
        />
      </label>
      {/* Piege a robots : hors ecran, hors tabulation, ignore des lecteurs d'ecran */}
      <label className="v4-trap" aria-hidden="true">
        Company
        <input type="text" name="company" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </label>
      <div className="v4-form-foot">
        <button type="submit" className="v4-send" disabled={busy} tabIndex={tab}>
          {busy ? 'Sending' : 'Send'}
        </button>
        <p className="v4-form-status" role="status" aria-live="polite" data-status={status}>
          {status === 'sent' && 'Sent. Thank you, I will get back to you soon.'}
          {status === 'error' && (
            <>
              Could not send. Try again, or write to{' '}
              <a className="v4-contact-mail" href={`mailto:${FALLBACK_EMAIL}`} tabIndex={tab}>
                {FALLBACK_EMAIL}
              </a>
              .
            </>
          )}
        </p>
      </div>
    </form>
  );
};

export default ContactForm;
