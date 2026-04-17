import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang, translations } from '../translations';

export type DesignMode = 'original' | 'alternate';

// Themes de couleur pour le fond video meduses
// Approche grayscale + multiply overlay : desature totalement puis teinte
export type ThemeKey = 'ocean' | 'aqua' | 'ember' | 'forest' | 'amethyst' | 'gold' | 'rose';
export const THEMES: Record<ThemeKey, { label: string; swatch: string; grayscale: number; brightness: number; contrast: number; tint: string }> = {
  ocean:    { label: 'Ocean',    swatch: '#7cc7ff', grayscale: 0,    brightness: 1.0, contrast: 1.0, tint: 'transparent' }, // video brute, aucun traitement
  aqua:     { label: 'Aqua',     swatch: '#00e5cc', grayscale: 1,    brightness: 1.4, contrast: 1.2, tint: '#4dffe0' },
  ember:    { label: 'Ember',    swatch: '#ff6a3d', grayscale: 1,    brightness: 1.4, contrast: 1.25,tint: '#ff5522' },
  forest:   { label: 'Forest',   swatch: '#4caf50', grayscale: 1,    brightness: 1.3, contrast: 1.2, tint: '#4dee88' },
  amethyst: { label: 'Amethyst', swatch: '#b06cff', grayscale: 1,    brightness: 1.3, contrast: 1.2, tint: '#b880ff' },
  gold:     { label: 'Gold',     swatch: '#ffcc00', grayscale: 1,    brightness: 1.5, contrast: 1.2, tint: '#ffdd55' },
  rose:     { label: 'Rose',     swatch: '#ff77aa', grayscale: 1,    brightness: 1.35,contrast: 1.2, tint: '#ff66aa' },
};

type AppContextType = {
  designMode: DesignMode;
  setDesignMode: (m: DesignMode) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof translations.en;
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [designMode, setDesignModeState] = useState<DesignMode>('alternate');
  // Langue forcee a 'en' (FR desactive)
  const lang: Lang = 'en';
  const setLang = (_l: Lang) => {};

  const [theme, setThemeState] = useState<ThemeKey>(() => {
    const saved = localStorage.getItem('mm_theme') as ThemeKey | null;
    return saved && saved in THEMES ? saved : 'ocean';
  });

  const setTheme = (t: ThemeKey) => {
    setThemeState(t);
    localStorage.setItem('mm_theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  const setDesignMode = (m: DesignMode) => {
    setDesignModeState(m);
    localStorage.setItem('mm_design', m);
    document.documentElement.classList.toggle('design-alternate', m === 'alternate');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('design-alternate', designMode === 'alternate');
  }, [designMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const t = translations[lang];

  return (
    <AppContext.Provider value={{ designMode, setDesignMode, lang, setLang, t, theme, setTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
