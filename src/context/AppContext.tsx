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

/**
 * Detecte la langue du navigateur : 'fr' pour France/Quebec, 'es' pour
 * Espagne/LATAM, 'en' fallback par defaut pour le reste du monde.
 * Lit aussi localStorage si l'utilisateur a fait un choix manuel.
 */
function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';

  // Preference utilisateur en localStorage en priorite
  try {
    const stored = window.localStorage.getItem('mm_lang');
    if (stored === 'fr' || stored === 'en' || stored === 'es') return stored;
  } catch {}

  // Sinon detection navigateur (gere navigator.language + legacy userLanguage)
  const raw =
    (navigator as Navigator & { userLanguage?: string }).language ||
    (navigator as Navigator & { userLanguage?: string }).userLanguage ||
    'en';
  const code = raw.toLowerCase().slice(0, 2);

  if (code === 'fr') return 'fr';
  if (code === 'es') return 'es';
  return 'en';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [designMode, setDesignModeState] = useState<DesignMode>('alternate');
  const [lang, setLangState] = useState<Lang>('en');

  // Detection au mount (client-only, pas SSR)
  useEffect(() => {
    const detected = detectLang();
    setLangState(detected);
    // Met a jour <html lang=""> pour SEO + accessibilite
    document.documentElement.lang = detected;
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem('mm_lang', l);
    } catch {}
    document.documentElement.lang = l;
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
