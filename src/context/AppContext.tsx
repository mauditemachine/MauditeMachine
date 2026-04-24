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
 * Espagne/LATAM, 'en' fallback par defaut ABSOLU pour tout le reste
 * (en-US, en-GB, en-CA, en-AU, de, it, pt, ja, zh, etc.).
 * Lit aussi localStorage si l'utilisateur a fait un choix manuel.
 */
function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';

  // Preference utilisateur en localStorage en priorite (mm_lang)
  try {
    const stored = window.localStorage.getItem('mm_lang');
    if (stored === 'fr' || stored === 'en' || stored === 'es') return stored;
  } catch {}

  // Sinon detection navigateur : navigator.language + fallback legacy userLanguage
  const raw =
    (navigator as Navigator & { userLanguage?: string }).language ||
    (navigator as Navigator & { userLanguage?: string }).userLanguage ||
    'en';

  // Belt & suspenders : split('-')[0] + slice(0,2) pour isoler le code langue
  // (gere "en-US", "en-GB", "fr-CA", "es-MX", "zh-Hans-CN", etc.)
  const code = raw.toLowerCase().split('-')[0].slice(0, 2);

  // Seules 2 langues declenchent un switch. Tout le reste = 'en' par defaut.
  if (code === 'fr') return 'fr';
  if (code === 'es') return 'es';
  return 'en'; // Fallback absolu
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [designMode, setDesignModeState] = useState<DesignMode>('alternate');
  // Lazy init : detection fait AU PREMIER RENDER, pas dans useEffect.
  // Evite le flash "EN -> FR" visible quand localStorage override.
  const [lang, setLangState] = useState<Lang>(() => detectLang());

  // Sync <html lang=""> pour SEO + accessibilite
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

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
