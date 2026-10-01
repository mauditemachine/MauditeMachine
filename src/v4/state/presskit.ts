/**
 * Le press kit en popup (2026-09-30) : ouvert ou non. Un seul document,
 * en anglais (version 4 pages) : aucune langue a choisir.
 */

let open = false;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

export const presskit = {
  get: (): boolean => open,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  open(): void {
    if (open) return;
    open = true;
    emit();
  },
  close(): void {
    if (!open) return;
    open = false;
    emit();
  },
};
