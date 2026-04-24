import type { Config } from 'tailwindcss'

/**
 * Design tokens Maudite Machine
 * Identité : dark, underground, liquid-glass, monochrome blanc.
 * Aucun gold ni yellow.
 */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  // Préserve les styles custom existants (styles.css ~8000 lignes).
  // Réactiver quand on aura migré toutes les pages vers Tailwind.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Palette : blanc + variantes translucides uniquement
        ink: {
          // Textes / borders / surfaces blanches translucides
          5:   'rgba(255, 255, 255, 0.05)',
          8:   'rgba(255, 255, 255, 0.08)',
          10:  'rgba(255, 255, 255, 0.10)',
          15:  'rgba(255, 255, 255, 0.15)',
          20:  'rgba(255, 255, 255, 0.20)',
          30:  'rgba(255, 255, 255, 0.30)',
          50:  'rgba(255, 255, 255, 0.50)',
          70:  'rgba(255, 255, 255, 0.70)',
          85:  'rgba(255, 255, 255, 0.85)',
          95:  'rgba(255, 255, 255, 0.95)',
        },
        // Glass fill (fond sombre translucide, comme header/footer)
        glass: {
          subtle:  'rgba(0, 0, 0, 0.12)',
          DEFAULT: 'rgba(0, 0, 0, 0.20)',
          strong:  'rgba(0, 0, 0, 0.35)',
        },
      },
      borderRadius: {
        // Échelle unifiée (remplace 4/6/8/10/12/14/16/20 scattered)
        sm:   '4px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl':'24px',
      },
      backdropBlur: {
        glass: '15px',     // Recette exacte header/footer
        heavy: '30px',
      },
      backdropSaturate: {
        // Force désaturation pour ne pas laver le texte sur vidéo bleue
        glass: '0.6',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.5)',
        'glow-white-soft': '0 0 0 1px rgba(255, 255, 255, 0.2), 0 0 24px rgba(255, 255, 255, 0.08)',
        'glow-white': '0 0 0 1px rgba(255, 255, 255, 0.4), 0 0 32px rgba(255, 255, 255, 0.15)',
      },
      fontFamily: {
        body: ['"SF Pro Rounded"', 'system-ui', 'sans-serif'],
        display: ['"SF Pro Rounded"', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        // Ease Apple-like
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'spring':   'cubic-bezier(0.25, 1.4, 0.5, 1)',
      },
      transitionDuration: {
        250: '250ms',
        400: '400ms',
        600: '600ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'reveal-y': {
          '0%':   { transform: 'translateY(110%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up':  'fade-up 0.6s cubic-bezier(0.19, 1, 0.22, 1) both',
        'fade-in':  'fade-in 0.4s ease-out both',
        'shimmer':  'shimmer 3s linear infinite',
        'reveal-y': 'reveal-y 0.9s cubic-bezier(0.19, 1, 0.22, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
