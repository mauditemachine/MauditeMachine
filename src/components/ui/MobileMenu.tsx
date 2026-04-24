/**
 * MobileMenu — hamburger + overlay full-screen Pro Max.
 *
 * - Bouton hamburger (3 lignes → croix) anime via CSS transforms (framer a du
 *   mal avec cette base de code pour les entrances, on reste pragmatique)
 * - Overlay glass-strong + blur-heavy + saturate 0.6
 * - Liens principaux en stagger via CSS animation-delay
 * - Ferme au clic sur un lien OU sur l'overlay
 * - Bloque le scroll document quand ouvert
 */

import React, { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { useTranslation } from '../../lib/i18n'

export interface MobileMenuLink {
  key: string
  label: string
  section: string
}

export interface MobileMenuSocial {
  label: string
  href: string
  icon: React.ReactNode
}

interface MobileMenuProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  activeSection: string
  onNavigate: (section: string) => void
  links: MobileMenuLink[]
  socials?: MobileMenuSocial[]
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onToggle,
  onClose,
  activeSection,
  onNavigate,
  links,
  socials,
}) => {
  const { t } = useTranslation()
  const a = t.a11y
  // Controle le mount/unmount pour que l'exit animation soit visible
  const [rendered, setRendered] = useState(isOpen)
  useEffect(() => {
    if (isOpen) {
      setRendered(true)
    } else {
      const t = setTimeout(() => setRendered(false), 350)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Bloque le scroll document quand menu ouvert
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isOpen])

  // ESC ferme le menu
  useEffect(() => {
    if (!isOpen) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isOpen, onClose])

  const handleLinkClick = (section: string) => {
    onNavigate(section)
    onClose()
  }

  return (
    <>
      {/* Bouton hamburger — fixed top-right, au-dessus de l'overlay */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? a.closeMenu : a.openMenu}
        aria-expanded={isOpen}
        aria-controls="mobile-menu-panel"
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 1001 }}
        className={cn(
          'mobile-menu-toggle',
          'hidden max-[900px]:flex items-center justify-center',
          'w-11 h-11 rounded-full',
          'bg-glass backdrop-blur-glass backdrop-saturate-glass',
          'border border-ink-15 shadow-glass',
          'transition-all duration-250 ease-out-expo',
          'active:scale-95',
        )}
      >
        <div className="relative w-5 h-5 flex flex-col items-center justify-center">
          <span
            className={cn(
              'absolute h-[2px] w-5 rounded-full bg-ink-95',
              'transition-all duration-350 ease-out-expo',
              isOpen ? 'translate-y-0 rotate-45' : '-translate-y-[5px]',
            )}
          />
          <span
            className={cn(
              'absolute h-[2px] w-5 rounded-full bg-ink-95',
              'transition-opacity duration-200',
              isOpen ? 'opacity-0' : 'opacity-100',
            )}
          />
          <span
            className={cn(
              'absolute h-[2px] w-5 rounded-full bg-ink-95',
              'transition-all duration-350 ease-out-expo',
              isOpen ? 'translate-y-0 -rotate-45' : 'translate-y-[5px]',
            )}
          />
        </div>
      </button>

      {/* Overlay + panel (CSS transitions, pas framer) */}
      {rendered && (
        <div
          id="mobile-menu-panel"
          role="dialog"
          aria-modal="true"
          aria-label={a.mainMenu}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            opacity: isOpen ? 1 : 0,
            transition: 'opacity 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
          }}
          className={cn(
            'flex items-center justify-center',
            'bg-glass-strong backdrop-blur-heavy backdrop-saturate-glass',
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <div
            className={cn(
              'w-full max-w-md px-8 py-16 flex flex-col items-center gap-8',
              'transition-transform duration-500 ease-out-expo',
              isOpen ? 'translate-y-0' : '-translate-y-3',
            )}
          >
            {/* Liens principaux */}
            <nav className="w-full flex flex-col items-center gap-3">
              {links.map((link, i) => {
                const active = activeSection === link.section
                return (
                  <button
                    key={link.key}
                    type="button"
                    onClick={() => handleLinkClick(link.section)}
                    style={{
                      animationDelay: `${100 + i * 70}ms`,
                      animationFillMode: 'both',
                    }}
                    className={cn(
                      'w-full py-3 rounded-xl cursor-pointer',
                      'font-display text-3xl font-black uppercase tracking-wide',
                      'transition-all duration-250 ease-out-expo',
                      'animate-fade-up',
                      active
                        ? 'text-ink-95 bg-ink-10 border border-ink-20 shadow-glow-white-soft'
                        : 'text-ink-70 bg-transparent border border-transparent hover:text-ink-95 hover:bg-ink-5',
                    )}
                  >
                    {link.label}
                  </button>
                )
              })}
            </nav>

            {/* Socials row */}
            {socials && socials.length > 0 && (
              <div
                style={{
                  animationDelay: `${100 + links.length * 70}ms`,
                  animationFillMode: 'both',
                }}
                className="flex items-center gap-4 pt-4 animate-fade-up"
              >
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className={cn(
                      'w-10 h-10 rounded-full',
                      'flex items-center justify-center',
                      'bg-ink-8 border border-ink-15',
                      'text-ink-85 hover:text-ink-95 hover:bg-ink-15',
                      'transition-all duration-250',
                    )}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default MobileMenu
