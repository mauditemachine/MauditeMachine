/**
 * Rampe des reglages audio (TONE, LEVEL, DIST, REVERB, DELAY, CHORUS,
 * STRETCH, inserts) : 20 ms, section 19 item 51.
 */

export const GLIDE_S = 0.02;

/**
 * Rampe lineaire de 20 ms depuis une valeur posee a l'instant present.
 * Pas setTargetAtTime : Chrome calcule cette approche pas a pas sur les
 * blocs REELLEMENT rendus, et un noeud au repos (bus muet entre deux coups)
 * n'en rend aucun ; le premier coup apres un reglage partait alors avec
 * l'ancienne valeur (mesure a l'analyseur : CH plein pot juste apres TONE
 * a 0). Une rampe se calcule depuis ses deux points, rendu ou non.
 */
export function glide(p: AudioParam, target: number, c: BaseAudioContext): void {
  const now = c.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + GLIDE_S);
}

/**
 * Un point de verrou pose a l'avance (2026-10-21, audit F14 : les verrous DIST, CHORUS, DELAY et REVERB d'une voix
 * sautaient au coup, setValueAtTime seul, et la queue du coup d'avant prenait une marche) : une rampe lineaire de
 * POINT_S qui finit a l'instant du coup, depuis la valeur d'avant (from) ; le coup part a la valeur du pas. Trop tard
 * pour la rampe (le coup est deja la) : la valeur tout de suite, comme avant.
 */
export const POINT_S = 0.003;
export function pointAt(p: AudioParam, from: number, to: number, when: number, c: BaseAudioContext): void {
  const now = c.currentTime;
  const t0 = when - POINT_S;
  if (t0 > now && from !== to) {
    p.setValueAtTime(from, t0);
    p.linearRampToValueAtTime(to, when);
  } else p.setValueAtTime(to, Math.max(when, now));
}
