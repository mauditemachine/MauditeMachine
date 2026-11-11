/**
 * Les mutes tenus du plugin (2026-11-11). Mika : "quand je suis sous MUTE et que j'appuie sur les touches pour muter des
 * tracks, si j'appuie sur SHIFT en meme temps ca fait juste se mettre en violet, et quand je release SHIFT le son repart
 * sans que je unmute : petit trick pour le live". En mode MUTE, Maj + un pas bascule sa piste le temps que Maj reste
 * tenue (une piste qui joue se coupe, une piste coupee revient) ; son pas passe en violet ; Maj relachee, chaque piste
 * retrouve son etat d'avant. Ici : quelles pistes sont tenues et leur etat d'avant (les actions les basculent,
 * actions/internal/keys60.ts ; la scene les peint, scene/renderer.ts). Module sans dependance.
 */

const held = new Map<string, boolean>();
const subs = new Set<() => void>();
const tell = (): void => subs.forEach((fn) => fn());

export const muteHold = {
  /** La piste est-elle tenue ? */
  has: (k: string): boolean => held.has(k),
  size: (): number => held.size,
  keys: (): string[] => [...held.keys()],
  /** Tient la piste k, coupee ou non avant (was). */
  add(k: string, was: boolean): void {
    held.set(k, was);
    tell();
  },
  /** Lache la piste k : rend son etat d'avant, undefined si elle n'etait pas tenue. */
  take(k: string): boolean | undefined {
    const was = held.get(k);
    if (was === undefined) return undefined;
    held.delete(k);
    tell();
    return was;
  },
  /** Lache tout : les pistes et leur etat d'avant. */
  takeAll(): [string, boolean][] {
    const out = [...held.entries()];
    if (out.length === 0) return out;
    held.clear();
    tell();
    return out;
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
};
