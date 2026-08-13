/**
 * AboutPage — biographie complete + photos.
 * Wrap le composant Presskit (deja existant, contient toute la mise en page
 * magazine : bio 2-col, stats, remix, album, catalogue, VRSTL, contact, download).
 */

import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import EditorialPhoto from '../components/ui/EditorialPhoto';
import { useTranslation } from '../lib/i18n';

const Presskit = React.lazy(() => import('../components/Presskit'));

const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="pt-24 pb-32">
      <h1 className="sr-only">{t.headings.about}</h1>

      <Suspense fallback={null}>
        <Presskit onNavigateToMessage={() => navigate('/v1/contact')} />
      </Suspense>

      {/* Editorial photo MM1 avec parallax — ferme la page About en beaute */}
      <section
        aria-label="Editorial spread"
        className="py-8 md:py-16 px-4 md:px-8 max-w-[1600px] mx-auto w-full"
      >
        <EditorialPhoto
          src="/images/MauditeMachine-1.webp"
          alt="Maudite Machine"
          issueTag={t.editorial.issueTag}
          caption={t.editorial.caption}
          heightVh={70}
        />
      </section>
    </div>
  );
};

export default AboutPage;
