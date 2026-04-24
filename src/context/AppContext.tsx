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

  // ETAT INITIAL FORCE SUR 'en' : pas de localStorage read, pas de lazy
  // init. Detection fait cote client dans le useEffect ci-dessous.
  const [lang, setLangState] = useState<Lang>('en');

  // Detection navigator.language au mount, fallback absolu 'en'.
  // Conforme au brief utilisateur : localStorage stale corrige ici.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const browserLang =
      (navigator as Navigator & { userLanguage?: string }).language ||
      (navigator as Navigator & { userLanguage?: string }).userLanguage ||
      'en';
    const shortLang = browserLang.split('-')[0].toLowerCase();

    if (shortLang === 'fr') setLangState('fr');
    else if (shortLang === 'es') setLangState('es');
    else setLangState('en'); // FALLBACK ABSOLU SUR L'ANGLAIS

    // Clean localStorage stale d'anciennes versions pour ne pas
    // re-contaminer la detection sur rechargements futurs.
    try {
      window.localStorage.removeItem('mm_lang');
    } catch {}
  }, []);

  // Sync <html lang=""> pour SEO + accessibilite
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  // setLang exposee pour toggle manuel futur (sans persistence localStorage)
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
