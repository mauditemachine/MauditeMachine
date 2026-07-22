/**
 * ContactPage — formulaire de contact (Message component).
 */

import React from 'react';
import Message from '../components/Message';
import { useTranslation } from '../lib/i18n';

const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-5xl mx-auto w-full">
      <h1 className="sr-only">{t.headings.contact}</h1>

      <Message />
    </section>
  );
};

export default ContactPage;
