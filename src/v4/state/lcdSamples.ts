/**
 * Page SAMPLES de l'ecran (2026-10-05, Mika : "quand on commence a tourner le
 * knob on voit sur l'ecran la liste des echantillons ; on a appuye sur un
 * voice et la on choisit le sample") : tourner le potard SAMPLE de la rangee
 * VOICE (la voix selectionnee) ouvre un instant la liste des sons de sa
 * famille (909, 808, MM, puis ses echantillons), le son du moment en
 * surbrillance. Appuyer sur une autre voix pendant ce temps la change : la
 * liste suit. Les actions l'ouvrent ; le compositeur (state/lcd.ts) la place
 * au-dessus des trois lignes de texte tant qu'elle dure (comme la page MIX,
 * state/lcdMix.ts).
 */

/** Duree d'affichage apres le dernier reglage (ou le dernier pad). */
export const LCD_SAMPLES_MS = 2400;

let until = 0;
const listeners = new Set<() => void>();

export const lcdSamples = {
  /** La page est-elle ouverte ? */
  get(now: number = performance.now()): boolean {
    return now < until;
  },
  show(ms: number = LCD_SAMPLES_MS): void {
    until = performance.now() + ms;
    listeners.forEach((fn) => fn());
  },
  /** Fermee tout de suite (un autre message prend l'ecran). */
  hide(): void {
    if (until === 0) return;
    until = 0;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
