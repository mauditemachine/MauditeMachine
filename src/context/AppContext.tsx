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

// Lit preference langue : URL ?lang=xx > navigator.languages[0].
// Renvoie 'en' | 'fr' | 'es' strictement. Fallback 'en' absolu.
function pickLang(): Lang {
  if (typeof window === 'undefined') return 'en';

  // 1) URL override emergency : ?lang=en / ?lang=fr / ?lang=es
  try {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get('lang');
    if (forced === 'en' || forced === 'fr' || forced === 'es') return forced;
  } catch {}

  // 2) navigator.languages (plural, liste ordonnee des preferences)
  //    + fallback navigator.language + userLanguage (legacy IE)
  const candidates: string[] =
    (navigator.languages && navigator.languages.length > 0)
      ? Array.from(navigator.languages)
      : [
          (navigator as Navigator & { userLanguage?: string }).language ||
          (navigator as Navigator & { userLanguage?: string }).userLanguage ||
          'en',
        ];

  // 3) Premiere langue supportee dans l'ordre de preference utilisateur
  for (const raw of candidates) {
    if (!raw) continue;
    const short = raw.toLowerCase().split('-')[0];
    if (short === 'en') return 'en';
    if (short === 'fr') return 'fr';
    if (short === 'es') return 'es';
  }

  // 4) Fallback absolu
  return 'en';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [designMode, setDesignModeState] = useState<DesignMode>('alternate');

  // Lazy init : detection faite AU PREMIER RENDER (pas de flash EN -> FR/ES).
  // localStorage n'est PLUS LU du tout pour eviter contamination stale.
  const [lang, setLangState] = useState<Lang>(() => pickLang());

  // Nettoyage localStorage stale + log debug au mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('mm_lang');
    } catch {}
    // Debug trace (visible dans la console navigateur) pour diagnostiquer
    // les cas litigieux. Peut etre retire plus tard si trop bruyant.
    try {
      // eslint-disable-next-line no-console
      console.info(
        '[i18n] detected lang:', lang,
        '| navigator.languages:', navigator.languages,
        '| navigator.language:', navigator.language,
      );
    } catch {}
  }, [lang]);

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
