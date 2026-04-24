/**
 * i18n lib — hook `useTranslation` zero-dependance.
 *
 * Re-exporte au-dessus de AppContext (qui gere deja la detection
 * navigator.language + le store localStorage). Ce fichier fournit l'API
 * idiomatique React `const { t, lang, setLang } = useTranslation();`
 * pour simplifier l'usage dans les composants.
 */

import { useApp } from '../context/AppContext';
import type { Lang } from '../translations';
export type { Lang } from '../translations';

/**
 * Hook principal : retourne le dictionnaire localise + utilities lang.
 *
 * Usage :
 *   const { t } = useTranslation();
 *   <h1>{t.presskit.sectionTitle}</h1>
 */
export function useTranslation() {
  const { t, lang, setLang } = useApp();
  return { t, lang, setLang } as {
    t: ReturnType<typeof useApp>['t'];
    lang: Lang;
    setLang: (l: Lang) => void;
  };
}

/**
 * I18nProvider : alias de AppProvider pour signaler explicitement
 * l'intention i18n dans l'App shell.
 */
export { AppProvider as I18nProvider } from '../context/AppContext';
