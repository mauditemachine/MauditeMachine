/**
 * GoodiesPage — wallpapers + covers + stickers en telechargement gratuit.
 */

import React from 'react';
import Goodies from '../components/Goodies';
import { useTranslation } from '../lib/i18n';

const GoodiesPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <h1 className="sr-only">{t.headings.goodies}</h1>

      <Goodies />
    </section>
  );
};

export default GoodiesPage;
