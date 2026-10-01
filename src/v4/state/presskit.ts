/**
 * La visionneuse du press kit (2026-09-30 ; route /presskit le 2026-10-01) :
 * ouverte ou non, et d'ou. Un seul document, en anglais.
 *
 * origin : 'route' (arrivee par /presskit, 250 ms apres le montage),
 * 'press' (le bouton PRESS, apres une arrivee par /presskit), 'link' (le
 * lien du press kit dans la section PRESS). Arrive par /presskit, le
 * visiteur rouvre la visionneuse par PRESS ; a la premiere fermeture, une
 * ligne le lui dit une seule fois (hint).
 */

export type KitOrigin = 'route' | 'press' | 'link';

let open = false;
let origin: KitOrigin = 'link';
let fromRoute = false;
let hint = false;
let hintShown = false;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

export const presskit = {
  get: (): boolean => open,
  origin: (): KitOrigin => origin,
  /** arrive par /presskit : PRESS rouvre la visionneuse */
  fromRoute: (): boolean => fromRoute,
  /** la ligne "Press kit closed. Reopen from the PRESS button." est a l'ecran */
  hint: (): boolean => hint,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  open(from: KitOrigin = 'link'): void {
    if (from === 'route') fromRoute = true;
    origin = from;
    hint = false;
    if (open) {
      emit();
      return;
    }
    open = true;
    emit();
  },
  close(): void {
    if (!open) return;
    open = false;
    if (fromRoute && !hintShown) {
      hint = true;
      hintShown = true;
    }
    emit();
  },
  dismissHint(): void {
    if (!hint) return;
    hint = false;
    emit();
  },
};
