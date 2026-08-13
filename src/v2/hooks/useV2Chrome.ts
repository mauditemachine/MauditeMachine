/**
 * Chrome commun des pages /v2 : classe body (neutralise le padding mobile
 * v1 + fond noir), meta robots noindex tant que la refonte est en preview,
 * meta description propre, titre document. Tout est restaure au unmount
 * pour rendre la v1 intacte.
 */

import { useEffect } from 'react';

const V2_DESCRIPTION =
  'DJ and producer for 15 years. Indie dance, dark disco and hypnotic minimal. Founder of VRSTL Records. Canada · France · Spain.';

export default function useV2Chrome(title: string) {
  useEffect(() => {
    document.body.classList.add('v2-active');

    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const robots = existing ?? document.createElement('meta');
    const prevRobots = existing?.content ?? null;
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    if (!existing) document.head.appendChild(robots);

    const prevTitle = document.title;
    document.title = title;

    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = desc?.content ?? null;
    if (desc) desc.content = V2_DESCRIPTION;

    return () => {
      document.body.classList.remove('v2-active');
      if (prevRobots !== null) robots.content = prevRobots;
      else robots.remove();
      if (desc && prevDesc !== null) desc.content = prevDesc;
      document.title = prevTitle;
    };
  }, [title]);
}
