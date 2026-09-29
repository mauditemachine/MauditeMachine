/**
 * Messages passagers de l'ecran (spec 5.5 et 7.2) : STEP 07 BD ON,
 * CLEARED, TAP A PAD FIRST. Les actions les ecrivent ; le compositeur de
 * l'ecran (state/lcd.ts) les affiche 800 ms en ligne 2, l'ecran 3D
 * (scene/screen.ts) et son jumeau (ui/Lcd.tsx) les montrent, le debug les
 * lit (window.__v4.state.lcdMessage).
 */

export interface LcdMessage {
  text: string;
  /** performance.now() de fin d'affichage */
  until: number;
}

/** Duree d'un message ordinaire (spec 5.5). */
export const LCD_MESSAGE_MS = 800;

let current: LcdMessage | null = null;
const listeners = new Set<() => void>();

export const lcdMessage = {
  /** Le message encore affiche a `now`, ou null. */
  get(now: number = performance.now()): LcdMessage | null {
    return current && now < current.until ? current : null;
  },
  show(text: string, ms: number = LCD_MESSAGE_MS): void {
    current = { text, until: performance.now() + ms };
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
