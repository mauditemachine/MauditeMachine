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

/**
 * La liste montree (2026-10-08, l'etape R3, les deux couches) : sound, le
 * choix de son d'avant (909, 808, MM, les samples : SOUND, la plaque) ;
 * machine, les machines de la couche SYNTH (MACHINE de SRC) ; sample, la
 * couche SAMPLE (OFF puis les samples : SAMPLE de SMPL).
 */
export type LcdSamplesKind = 'sound' | 'machine' | 'sample';

let until = 0;
let kind: LcdSamplesKind = 'sound';
const listeners = new Set<() => void>();

export const lcdSamples = {
  /** La page est-elle ouverte ? */
  get(now: number = performance.now()): boolean {
    return now < until;
  },
  /** Ce que montre la liste ouverte. */
  kind(): LcdSamplesKind {
    return kind;
  },
  show(ms: number = LCD_SAMPLES_MS, k: LcdSamplesKind = 'sound'): void {
    until = performance.now() + ms;
    kind = k;
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
