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
  // Langue forcee a 'en' (FR desactive)
  const lang: Lang = 'en';
  const setLang = (_l: Lang) => {};

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
