import { useApp, THEMES, ThemeKey } from '../context/AppContext'

/**
 * Switcher de theme - pastilles colorees dans le header.
 * Clic = change la teinte du fond video meduses.
 */
export default function ThemeSwitcher() {
  const { theme, setTheme } = useApp()

  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Choisir un theme de couleur">
      {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
        const t = THEMES[key]
        const active = theme === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.label}
            title={t.label}
            className={`theme-dot ${active ? 'active' : ''}`}
            style={{ ['--dot-color' as any]: t.swatch }}
            onClick={() => setTheme(key)}
          />
        )
      })}
    </div>
  )
}
