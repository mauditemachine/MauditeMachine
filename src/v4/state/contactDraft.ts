/**
 * Brouillon du formulaire de CONTACT (2026-10-01) : l'objet (et parfois le
 * message) se remplit selon d'ou le visiteur arrive. CONTACT ouvert
 * directement : Booking ; STUDIO, "Ask about a lesson" : Lesson ; MERCH,
 * "Order" : Merch order - <produit>, avec la commande dans le message ;
 * LIVE : Booking - live set ; PRESS : Press. seq change a chaque demande :
 * le formulaire reprend l'objet et le message proposes (sans toucher au nom
 * ni au courriel deja tapes).
 */

export type ContactTopic = 'booking' | 'live' | 'merch' | 'lesson' | 'press' | 'other';

export interface ContactDraft {
  topic: ContactTopic;
  subject: string;
  message: string;
  seq: number;
}

export const TOPIC_SUBJECT: Readonly<Record<ContactTopic, string>> = {
  booking: 'Booking',
  live: 'Booking - live set',
  merch: 'Merch order',
  lesson: 'Lesson',
  press: 'Press',
  other: 'Message',
};

let draft: ContactDraft = { topic: 'booking', subject: TOPIC_SUBJECT.booking, message: '', seq: 0 };
const listeners = new Set<() => void>();

export const contactDraft = {
  get: (): ContactDraft => draft,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Nouvel objet propose (et message, s'il y en a un). */
  set(topic: ContactTopic, subject?: string, message = ''): void {
    draft = { topic, subject: subject ?? TOPIC_SUBJECT[topic], message, seq: draft.seq + 1 };
    listeners.forEach((fn) => fn());
  },
};
