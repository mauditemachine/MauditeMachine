/**
 * Le mode FILL du MM-RYTM (V.5.1, 2026-10-29, l'etape D2 facon Digitakt, docs/v4/digitakt-d2-spec.md section 3) : tant
 * qu'on le tient, les trigs a condition FILL jouent et ceux a !FILL se taisent. Tenir YES (plus de 250 ms) sans menu ouvert,
 * ou la cible MIDI rytm:fill (hold). Plusieurs mains peuvent le tenir a la fois (la souris, un controleur) : il reste tenu
 * tant qu'une le tient. L'horloge (audio/clock.ts) re-programme les pas a venir a chaque changement ; l'en-tete de l'ecran
 * affiche FILL. Jamais garde : une visite repart sans FILL.
 */

const holders = new Set<string>();
const listeners = new Set<() => void>();
let on = false;

function update(): void {
  const next = holders.size > 0;
  if (next === on) return;
  on = next;
  listeners.forEach((fn) => fn());
}

export const fill = {
  get on(): boolean {
    return on;
  },
  /** Une main (who : 'yes', 'midi'...) tient FILL ou le lache. */
  hold(who: string, down: boolean): void {
    if (down) holders.add(who);
    else holders.delete(who);
    update();
  },
  /** Tout lache (la page perd le focus, un test). */
  release(): void {
    holders.clear();
    update();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
