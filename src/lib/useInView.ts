/**
 * useInView — hook IntersectionObserver simple et fiable.
 *
 * framer-motion whileInView a des quirks dans ce codebase (StrictMode +
 * Vite HMR + Preflight disable), donc on fait du vanilla robuste.
 */

import { useEffect, useRef, useState } from 'react'

interface UseInViewOptions {
  /** Fraction visible pour trigger (0-1). Default 0.2. */
  amount?: number
  /** Si true, once: le hook reste `true` apres premiere entree. */
  once?: boolean
  /** Root margin (standard IO syntax). */
  rootMargin?: string
}

export function useInView<T extends HTMLElement = HTMLElement>(
  options: UseInViewOptions = {},
) {
  const { amount = 0.2, once = true, rootMargin = '0px' } = options
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold: amount, rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [amount, once, rootMargin])

  return [ref, inView] as const
}
