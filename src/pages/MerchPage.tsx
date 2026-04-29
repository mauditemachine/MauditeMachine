/**
 * MerchPage — boutique merchandising.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Store from '../components/Store';

const MerchPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section className="pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <Store
        onSectionChange={(s) => {
          if (s === 'message' || s === 'contact') navigate('/contact');
        }}
      />
    </section>
  );
};

export default MerchPage;
