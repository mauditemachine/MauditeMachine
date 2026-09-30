/**
 * Messages passagers de l'ecran (spec 5.5, 7.2 et 20.3.8) : STEP 07 BD ON,
 * CLEARED, TAP A PAD FIRST, NO SIGNAL, et la valeur de l'encodeur qu'on
 * tourne (TONE 80%, SWING 58%...). Les actions les ecrivent ; le
 * compositeur de l'ecran (state/lcd.ts) les affiche en ligne 3, l'ecran 3D
 * (scene/screen.ts) et son jumeau (ui/Lcd.tsx) les montrent, le debug les
 * lit (window.__v4.state.lcdMessage). param : une valeur d'encodeur, que
 * le jumeau n'annonce pas (le curseur du jumeau annonce deja la sienne).
 */

export interface LcdMessage {
  text: string;
  /** performance.now() de fin d'affichage */
  until: number;
  /** valeur d'un encodeur (1200 ms), pas un message */
  param: boolean;
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
  show(text: string, ms: number = LCD_MESSAGE_MS, param = false): void {
    current = { text, until: performance.now() + ms, param };
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
