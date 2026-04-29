/**
 * GoodiesPage — wallpapers + covers + stickers en telechargement gratuit.
 */

import React from 'react';
import Goodies from '../components/Goodies';

const GoodiesPage: React.FC = () => {
  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <Goodies />
    </section>
  );
};

export default GoodiesPage;
