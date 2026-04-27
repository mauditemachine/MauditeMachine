/**
 * ContactPage — formulaire de contact (Message component).
 */

import React from 'react';
import Message from '../components/Message';

const ContactPage: React.FC = () => {
  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-6 md:px-10 max-w-5xl mx-auto w-full">
      <Message />
    </section>
  );
};

export default ContactPage;
