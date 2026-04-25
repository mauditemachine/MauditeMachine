import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang, translations } from '../translations';

export type DesignMode = 'original' | 'alternate';

type AppContextType = {
  designMode: DesignMode;
  setDesignMode: (m: DesignMode) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof translations.en;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [designMode, setDesignModeState] = useState<DesignMode>('alternate');

  // ETAT INITIAL : 'en' STRICT (jamais d'autre langue par defaut).
  // Detection faite cote client dans le useEffect ci-dessous.
  const [lang, setLangState] = useState<Lang>('en');

  // Detection langue navigateur au mount.
  // Logique exacte specifiee par l'utilisateur, fallback absolu sur 'en'.
  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    // Escape hatch : ?lang=en / ?lang=fr / ?lang=es dans l'URL force la langue
    try {
      const params = new URLSearchParams(window.location.search);
      const forced = params.get('lang');
      if (forced === 'en' || forced === 'fr' || forced === 'es') {
        setLangState(forced);
        document.documentElement.lang = forced;
        return;
      }
    } catch {}

    // 1. Obtenir la langue du navigateur de maniere robuste
    const nav = navigator as Navigator & { userLanguage?: string };
    const browserLang =
      nav.language ||
      nav.userLanguage ||
      (nav.languages && nav.languages[0]) ||
      'en';

    // 2. Extraire le code court (ex: 'en-US' -> 'en')
    const shortLang = browserLang.split('-')[0].toLowerCase();

    // 3. Fallback STRICT sur 'en' si ni 'fr' ni 'es'
    let detected: Lang = 'en';
    if (shortLang === 'fr') detected = 'fr';
    else if (shortLang === 'es') detected = 'es';
    else detected = 'en'; // FALLBACK ABSOLU SUR L'ANGLAIS

    setLangState(detected);
    document.documentElement.lang = detected;

    // Nettoyage localStorage stale d'anciennes versions (mm_lang='fr' qui
    // contaminait la detection).
    try {
      window.localStorage.removeItem('mm_lang');
    } catch {}

    // Trace debug visible dans la console navigateur
    try {
      // eslint-disable-next-line no-console
      console.info(
        '[i18n]',
        'detected:', detected,
        '| navigator.language:', nav.language,
        '| navigator.languages:', nav.languages,
      );
    } catch {}
  }, []);

  // setLang manuel (toggle UI futur, sans persistence localStorage)
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l;
    }
  };

  const setDesignMode = (m: DesignMode) => {
    setDesignModeState(m);
    localStorage.setItem('mm_design', m);
    document.documentElement.classList.toggle('design-alternate', m === 'alternate');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('design-alternate', designMode === 'alternate');
  }, [designMode]);

  const t = translations[lang];

  return (
    <AppContext.Provider value={{ designMode, setDesignMode, lang, setLang, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
