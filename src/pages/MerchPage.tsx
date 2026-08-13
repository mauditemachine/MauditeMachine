/**
 * MerchPage — boutique merchandising.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Store from '../components/Store';
import { useTranslation } from '../lib/i18n';

const MerchPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <h1 className="sr-only">{t.headings.merch}</h1>

      <Store
        onSectionChange={(s) => {
          if (s === 'message' || s === 'contact') navigate('/v1/contact');
        }}
      />
    </section>
  );
};

export default MerchPage;
