/**
 * Chrome commun des pages v2 : classe body (neutralise le padding mobile
 * du CSS v1 + fond noir garanti) et titre du document.
 *
 * Depuis la bascule (2026-08), la v2 EST le site : les metas par defaut
 * d'index.html (description, OG, JSON-LD, robots "index, follow") sont
 * deja les siennes — ce hook n'y touche plus. Le noindex de l'archive
 * v1 est pose par son Layout.
 */

import { useEffect } from 'react';

export default function useV2Chrome(title: string) {
  useEffect(() => {
    document.body.classList.add('v2-active');
    const prevTitle = document.title;
    document.title = title;
    return () => {
      document.body.classList.remove('v2-active');
      document.title = prevTitle;
    };
  }, [title]);
}
