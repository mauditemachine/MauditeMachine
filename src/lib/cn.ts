import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Compose des classes Tailwind/CSS conditionnellement.
 * Gère proprement les conflits Tailwind (ex: p-2 et p-4 → garde p-4).
 *
 * @example
 *   <div className={cn('p-2 text-white', isActive && 'bg-ink-10')} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
